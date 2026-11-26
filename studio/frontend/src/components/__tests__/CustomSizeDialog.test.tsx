import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CustomSizeDialog } from '../CustomSizeDialog';

afterEach(cleanup);

describe('exact output dimensions', () => {
  it('keeps non-multiple dimensions unchanged and applies the original reference dimensions', async () => {
    const onApply = vi.fn();
    render(<CustomSizeDialog open exact maxSide={4096} value="1920x1080" referenceSize={{ width: 999, height: 777 }} onApply={onApply} onOpenChange={vi.fn()} />);
    await act(async () => {});
    expect(screen.getByLabelText('高度')).toHaveValue(1080);
    fireEvent.click(screen.getByRole('button', { name: /使用首张参考图原尺寸/ }));
    expect(screen.getByLabelText('宽度')).toHaveValue(999);
    expect(screen.getByLabelText('高度')).toHaveValue(777);
    fireEvent.click(screen.getByRole('button', { name: '确定' }));
    expect(onApply).toHaveBeenCalledWith('999x777');
  });

  it('rejects oversize and fractional input without rounding or truncation', async () => {
    render(<CustomSizeDialog open exact maxSide={4096} onApply={vi.fn()} onOpenChange={vi.fn()} />);
    await act(async () => {});
    for (const width of ['4097', '12', '1920.5', '']) {
      fireEvent.change(screen.getByLabelText('宽度'), { target: { value: width } });
      expect(screen.getByRole('button', { name: '确定' })).toBeDisabled();
    }
  });
});
