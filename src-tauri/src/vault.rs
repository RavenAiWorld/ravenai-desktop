use std::{fs, path::Path};

#[cfg(windows)]
fn protect(_directory: &Path, bytes: &[u8], encrypt: bool) -> Result<Vec<u8>, String> {
    use windows_sys::Win32::{
        Foundation::LocalFree,
        Security::Cryptography::{
            CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
        },
    };
    let input = CRYPT_INTEGER_BLOB {
        cbData: bytes.len().try_into().map_err(|_| "Session is too large")?,
        pbData: bytes.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };
    // DPAPI binds the encrypted session to the current Windows account.
    unsafe {
        let ok = if encrypt {
            CryptProtectData(
                &input,
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        } else {
            CryptUnprotectData(
                &input,
                std::ptr::null_mut(),
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        };
        if ok == 0 {
            return Err("Windows could not protect the login session".into());
        }
        let result = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        LocalFree(output.pbData as *mut _);
        Ok(result)
    }
}

#[cfg(not(windows))]
fn load_or_create_key(directory: &Path, create: bool) -> Result<[u8; 32], String> {
    use rand::RngCore;
    use std::io::Write;
    use std::os::unix::fs::PermissionsExt;

    let key_path = directory.join(".vault.key");
    if key_path.exists() {
        let raw = fs::read(&key_path).map_err(|_| "Cannot read local session key")?;
        if raw.len() != 32 {
            return Err("Invalid local session key".into());
        }
        let mut key = [0u8; 32];
        key.copy_from_slice(&raw);
        return Ok(key);
    }
    if !create {
        return Err("Missing local session key".into());
    }
    fs::create_dir_all(directory).map_err(|_| "Cannot create session storage")?;
    let _ = fs::set_permissions(directory, fs::Permissions::from_mode(0o700));
    let mut key = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut key);
    let tmp = directory.join(".vault.key.tmp");
    let mut file = fs::File::create(&tmp).map_err(|_| "Cannot save local session key")?;
    let _ = file.set_permissions(fs::Permissions::from_mode(0o600));
    file.write_all(&key)
        .and_then(|_| file.sync_all())
        .map_err(|_| "Cannot save local session key")?;
    drop(file);
    fs::rename(&tmp, &key_path).map_err(|_| "Cannot save local session key")?;
    let _ = fs::set_permissions(&key_path, fs::Permissions::from_mode(0o600));
    Ok(key)
}

#[cfg(not(windows))]
fn protect(directory: &Path, bytes: &[u8], encrypt: bool) -> Result<Vec<u8>, String> {
    use chacha20poly1305::{
        aead::{Aead, KeyInit},
        ChaCha20Poly1305, Nonce,
    };
    use rand::RngCore;

    const MAGIC: &[u8; 4] = b"RVV1";
    let key = load_or_create_key(directory, encrypt)?;
    let cipher = ChaCha20Poly1305::new_from_slice(&key)
        .map_err(|_| "Cannot initialize local session cipher")?;

    if encrypt {
        let mut nonce_bytes = [0u8; 12];
        rand::rngs::OsRng.fill_bytes(&mut nonce_bytes);
        let ciphertext = cipher
            .encrypt(Nonce::from_slice(&nonce_bytes), bytes)
            .map_err(|_| "Cannot encrypt login session")?;
        let mut out = Vec::with_capacity(4 + 12 + ciphertext.len());
        out.extend_from_slice(MAGIC);
        out.extend_from_slice(&nonce_bytes);
        out.extend_from_slice(&ciphertext);
        Ok(out)
    } else {
        if bytes.len() < 4 + 12 + 16 || &bytes[..4] != MAGIC {
            return Err("Invalid encrypted login session".into());
        }
        let nonce = Nonce::from_slice(&bytes[4..16]);
        cipher
            .decrypt(nonce, &bytes[16..])
            .map_err(|_| "Cannot decrypt login session".into())
    }
}

fn validate_vault_file_name(name: &str) -> Result<&str, String> {
    if name.is_empty()
        || name.len() > 80
        || name.contains("..")
        || !name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'-' || b == b'_')
    {
        return Err("Invalid vault storage name".into());
    }
    Ok(name)
}

pub fn read_named<T: serde::de::DeserializeOwned>(
    directory: &Path,
    name: &str,
) -> Result<Option<T>, String> {
    let safe = validate_vault_file_name(name)?;
    let file = directory.join(safe);
    if !file.exists() {
        return Ok(None);
    }
    let bytes = fs::read(file).map_err(|_| "Cannot read encrypted vault file")?;
    let plain = protect(directory, &bytes, false)?;
    serde_json::from_slice(&plain)
        .map(Some)
        .map_err(|_| "Cannot read encrypted vault file".into())
}

pub fn write_named<T: serde::Serialize>(
    directory: &Path,
    name: &str,
    data: &T,
) -> Result<(), String> {
    use std::io::Write;
    let safe = validate_vault_file_name(name)?;
    fs::create_dir_all(directory).map_err(|_| "Cannot create encrypted storage")?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(directory, fs::Permissions::from_mode(0o700));
    }
    let plain = serde_json::to_vec(data).map_err(|_| "Cannot save encrypted vault file")?;
    let bytes = protect(directory, &plain, true)?;
    let temp = directory.join(format!("{safe}.tmp"));
    let mut file = fs::File::create(&temp).map_err(|_| "Cannot save encrypted vault file")?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = file.set_permissions(fs::Permissions::from_mode(0o600));
    }
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|_| "Cannot save encrypted vault file")?;
    drop(file);
    let target = directory.join(safe);
    fs::rename(temp, &target).map_err(|_| "Cannot save encrypted vault file")?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&target, fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

pub fn clear_named(directory: &Path, name: &str) -> Result<(), String> {
    let safe = validate_vault_file_name(name)?;
    for candidate in [safe.to_string(), format!("{safe}.tmp")] {
        match fs::remove_file(directory.join(candidate)) {
            Ok(()) => (),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
            Err(_) => return Err("Cannot clear encrypted vault file".into()),
        }
    }
    Ok(())
}

pub fn read<T: serde::de::DeserializeOwned>(directory: &Path) -> Result<Option<T>, String> {
    read_named(directory, "session.bin").map_err(|_| "Cannot read the login session".into())
}

pub fn write<T: serde::Serialize>(directory: &Path, data: &T) -> Result<(), String> {
    write_named(directory, "session.bin", data).map_err(|_| "Cannot save the login session".into())
}

pub fn clear(directory: &Path) -> Result<(), String> {
    for name in ["session.bin", "session.tmp", "session.bin.tmp"] {
        match fs::remove_file(directory.join(name)) {
            Ok(()) => (),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
            Err(_) => return Err("Cannot clear the saved session".into()),
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn vault_roundtrip_contains_no_plaintext() {
        let dir = std::env::temp_dir().join(format!(
            "ravenai-vault-test-{}-{}",
            std::process::id(),
            rand::random::<u64>()
        ));
        let plain = b"disposable-test-session-not-a-real-token";
        let encrypted = protect(&dir, plain, true).unwrap();
        assert!(!encrypted.windows(plain.len()).any(|part| part == plain));
        assert_eq!(protect(&dir, &encrypted, false).unwrap(), plain);
        assert!(protect(&dir, b"invalid encrypted file", false).is_err());

        let mut secrets = HashMap::new();
        secrets.insert("demo-plugin".to_string(), "sk-plugin-secret-value-12345".to_string());
        write_named(&dir, "plugin-credentials-7.bin", &secrets).unwrap();
        let disk_bytes = fs::read(dir.join("plugin-credentials-7.bin")).unwrap();
        assert!(!disk_bytes
            .windows("sk-plugin-secret-value-12345".len())
            .any(|part| part == b"sk-plugin-secret-value-12345"));
        let loaded: HashMap<String, String> =
            read_named(&dir, "plugin-credentials-7.bin").unwrap().unwrap();
        assert_eq!(loaded, secrets);
        assert!(write_named(&dir, "../escape.bin", &secrets).is_err());

        clear_named(&dir, "plugin-credentials-7.bin").unwrap();
        let _ = clear(&dir);
        let _ = fs::remove_dir_all(&dir);
    }
}
