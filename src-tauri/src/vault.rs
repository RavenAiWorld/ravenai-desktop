use std::{fs, path::Path};

#[cfg(windows)]
fn protect(bytes: &[u8], encrypt: bool) -> Result<Vec<u8>, String> {
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
fn protect(_: &[u8], _: bool) -> Result<Vec<u8>, String> {
    Err("This build requires Windows credential protection".into())
}

pub fn read<T: serde::de::DeserializeOwned>(directory: &Path) -> Result<Option<T>, String> {
    let file = directory.join("session.bin");
    if !file.exists() {
        return Ok(None);
    }
    let bytes = fs::read(file).map_err(|_| "Cannot read the login session")?;
    let plain = protect(&bytes, false)?;
    serde_json::from_slice(&plain)
        .map(Some)
        .map_err(|_| "Cannot read the login session".into())
}

pub fn write<T: serde::Serialize>(directory: &Path, data: &T) -> Result<(), String> {
    use std::io::Write;
    fs::create_dir_all(directory).map_err(|_| "Cannot create session storage")?;
    let plain = serde_json::to_vec(data).map_err(|_| "Cannot save the login session")?;
    let bytes = protect(&plain, true)?;
    let temp = directory.join("session.tmp");
    let mut file = fs::File::create(&temp).map_err(|_| "Cannot save the login session")?;
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|_| "Cannot save the login session")?;
    drop(file);
    fs::rename(temp, directory.join("session.bin"))
        .map_err(|_| "Cannot save the login session".into())
}

pub fn clear(directory: &Path) -> Result<(), String> {
    for name in ["session.bin", "session.tmp"] {
        match fs::remove_file(directory.join(name)) {
            Ok(()) => (),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
            Err(_) => return Err("Cannot clear the saved session".into()),
        }
    }
    Ok(())
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    #[test]
    fn windows_roundtrip_contains_no_plaintext() {
        let plain = b"disposable-test-session-not-a-real-token";
        let encrypted = protect(plain, true).unwrap();
        assert!(!encrypted.windows(plain.len()).any(|part| part == plain));
        assert_eq!(protect(&encrypted, false).unwrap(), plain);
        assert!(protect(b"invalid encrypted file", false).is_err());
    }
}
