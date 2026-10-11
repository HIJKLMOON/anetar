import { useEffect, useMemo, useRef, useState } from "react";
import type { ProColumns } from "@ant-design/pro-components";

export interface BalancedColumnWidthRule {
  grow: number;
  preferredWidth?: number;
}

interface BalancedColumnWidthResult {
  scrollX: number;
  widths: Map<string, number>;
}

const getColumnKey = <RecordType>(column: ProColumns<RecordType>) => {
  if (column.key !== undefined) return String(column.key);
  if (Array.isArray(column.dataIndex)) return column.dataIndex.join(".");
  return column.dataIndex === undefined ? "" : String(column.dataIndex);
};

export const calculateBalancedColumnWidths = <RecordType>(
  columns: ProColumns<RecordType>[],
  containerWidth: number,
  rules: Record<string, BalancedColumnWidthRule>,
): BalancedColumnWidthResult => {
  const widths = new Map<string, number>();
  let baseWidth = 0;

  columns.forEach((column) => {
    const key = getColumnKey(column);
    if (!key || typeof column.width !== "number") return;
    widths.set(key, column.width);
    baseWidth += column.width;
  });

  const flexibleColumns = Object.entries(rules)
    .filter(([key, rule]) => widths.has(key) && rule.grow > 0)
    .map(([key, rule]) => ({ key, ...rule }));
  const targetWidth =
    flexibleColumns.length > 0
      ? Math.max(baseWidth, Math.floor(containerWidth))
      : baseWidth;
  let remainingWidth = targetWidth - baseWidth;

  let preferredColumns = flexibleColumns.filter((column) => {
    const preferredWidth = column.preferredWidth;
    return (
      preferredWidth !== undefined &&
      preferredWidth > (widths.get(column.key) || 0)
    );
  });

  while (remainingWidth > 0.01 && preferredColumns.length > 0) {
    const distributableWidth = remainingWidth;
    const totalWeight = preferredColumns.reduce(
      (total, column) => total + column.grow,
      0,
    );
    let distributedWidth = 0;

    preferredColumns.forEach((column) => {
      const currentWidth = widths.get(column.key) || 0;
      const preferredWidth = column.preferredWidth || currentWidth;
      const weightedWidth = (distributableWidth * column.grow) / totalWeight;
      const addedWidth = Math.min(weightedWidth, preferredWidth - currentWidth);
      widths.set(column.key, currentWidth + addedWidth);
      distributedWidth += addedWidth;
    });

    if (distributedWidth <= 0.01) break;
    remainingWidth -= distributedWidth;
    preferredColumns = preferredColumns.filter(
      (column) =>
        (widths.get(column.key) || 0) + 0.01 < (column.preferredWidth || 0),
    );
  }

  if (remainingWidth > 0.01 && flexibleColumns.length > 0) {
    const totalWeight = flexibleColumns.reduce(
      (total, column) => total + column.grow,
      0,
    );
    flexibleColumns.forEach((column) => {
      const currentWidth = widths.get(column.key) || 0;
      widths.set(
        column.key,
        currentWidth + (remainingWidth * column.grow) / totalWeight,
      );
    });
  }

  widths.forEach((width, key) => widths.set(key, Math.floor(width)));
  let roundingWidth =
    targetWidth -
    Array.from(widths.values()).reduce((total, width) => total + width, 0);
  let flexibleIndex = 0;
  while (roundingWidth > 0 && flexibleColumns.length > 0) {
    const key = flexibleColumns[flexibleIndex % flexibleColumns.length]?.key;
    if (!key) break;
    widths.set(key, (widths.get(key) || 0) + 1);
    roundingWidth -= 1;
    flexibleIndex += 1;
  }

  return { scrollX: targetWidth, widths };
};

export const useBalancedTableColumns = <RecordType>(
  columns: ProColumns<RecordType>[],
  rules: Record<string, BalancedColumnWidthRule>,
) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = (width?: number) => {
      const nextWidth = Math.max(0, Math.floor(width ?? 0));
      setContainerWidth((currentWidth) =>
        currentWidth === nextWidth ? currentWidth : nextWidth,
      );
    };
    const readContentWidth = () => {
      const styles = window.getComputedStyle(container);
      const horizontalPadding =
        Number.parseFloat(styles.paddingLeft) +
        Number.parseFloat(styles.paddingRight);
      updateWidth(container.clientWidth - horizontalPadding);
    };

    readContentWidth();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", readContentWidth);
      return () => window.removeEventListener("resize", readContentWidth);
    }

    const observer = new ResizeObserver(([entry]) => {
      updateWidth(entry?.contentRect.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(
    () => calculateBalancedColumnWidths(columns, containerWidth, rules),
    [columns, containerWidth, rules],
  );
  const balancedColumns = useMemo(
    () =>
      columns.map((column) => {
        const width = layout.widths.get(getColumnKey(column));
        return width === undefined ? column : { ...column, width };
      }),
    [columns, layout.widths],
  );

  return {
    columns: balancedColumns,
    containerRef,
    scrollX: layout.scrollX,
  };
};
