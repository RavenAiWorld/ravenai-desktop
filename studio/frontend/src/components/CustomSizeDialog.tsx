'use client';

import { useEffect, useMemo, useState } from 'react';
import { Maximize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CUSTOM_IMAGE_SIZE_LIMITS, normalizeCustomImageSize } from '@/lib/model-capabilities';

interface CustomSizeDialogProps {
  open: boolean;
  value?: string;
  maxSide: number;
  exact?: boolean;
  referenceSize?: { width: number; height: number };
  onOpenChange: (open: boolean) => void;
  onApply: (size: string) => void;
}

function parseSize(size?: string): { width: string; height: string } {
  const match = String(size || '').match(/^\s*(\d+)\s*[xX×]\s*(\d+)\s*$/);
  return {
    width: match?.[1] || '1024',
    height: match?.[2] || '1024',
  };
}

export function CustomSizeDialog({ open, value, maxSide, exact = false, referenceSize, onOpenChange, onApply }: CustomSizeDialogProps) {
  const parsed = parseSize(value);
  const [width, setWidth] = useState(parsed.width);
  const [height, setHeight] = useState(parsed.height);

  useEffect(() => {
    if (!open) return;
    const next = parseSize(value);
    queueMicrotask(() => {
      setWidth(next.width);
      setHeight(next.height);
    });
  }, [open, value]);

  const normalizedSize = useMemo(
    () => exact
      ? (/^\d+$/.test(width) && /^\d+$/.test(height) && [Number(width), Number(height)].every(side => Number.isInteger(side) && side >= 16 && side <= maxSide)
        ? `${Number(width)}x${Number(height)}` : undefined)
      : normalizeCustomImageSize(`${width}x${height}`, maxSide),
    [width, height, maxSide, exact]
  );

  const handleApply = () => {
    if (!normalizedSize) return;
    onApply(normalizedSize);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="inset-auto top-1/2 left-1/2 h-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border pt-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{exact ? '成品尺寸' : '自定义分辨率'}</DialogTitle>
          <DialogDescription>
            {exact ? `宽高各 16-${maxSide}px。成品按此尺寸保存；模型出图不同则等比缩放，比例不同时透明补边，不裁切、不拉伸。` : <>
              输入像素宽高，系统会自动规整到 16 的倍数。最大边长 {maxSide}px，长短边不超过 3:1，
              总像素需在 {CUSTOM_IMAGE_SIZE_LIMITS.minPixels.toLocaleString()} 到 {CUSTOM_IMAGE_SIZE_LIMITS.maxPixels.toLocaleString()} 之间。
            </>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {referenceSize && (
            <Button variant="outline" className="h-auto w-full whitespace-normal" onClick={() => { setWidth(String(referenceSize.width)); setHeight(String(referenceSize.height)); }}>
              <Maximize className="h-4 w-4 shrink-0" />
              使用首张参考图原尺寸 {referenceSize.width} x {referenceSize.height}
            </Button>
          )}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3">
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">宽度</span>
              <Input
                type="number"
                min={16}
                max={maxSide}
                step={exact ? 1 : 16}
                value={width}
                onChange={event => setWidth(event.target.value)}
              />
            </label>
            <span className="pb-2 text-sm text-muted-foreground">×</span>
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">高度</span>
              <Input
                type="number"
                min={16}
                max={maxSide}
                step={exact ? 1 : 16}
                value={height}
                onChange={event => setHeight(event.target.value)}
              />
            </label>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
            <Maximize className="h-4 w-4 text-muted-foreground" />
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">将使用</div>
              <div className="font-mono text-sm font-medium">
                {normalizedSize || `宽高需为 16-${maxSide} 的整数`}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleApply} disabled={!normalizedSize}>
            确定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
