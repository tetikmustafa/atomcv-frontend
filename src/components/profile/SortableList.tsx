'use client';

/**
 * Reordering, with the keyboard as a first-class way to do it (rule 5).
 *
 * Three collections reorder — sections, entries, atoms — and all three want
 * exactly this behaviour, so it lives here once. Getting it wrong in three
 * places is how a keyboard user ends up able to reorder some lists and not
 * others.
 *
 * Rule 5 asks for two things and they are not redundant:
 *
 * - **A keyboard sensor.** dnd-kit's, so Space picks an item up, arrows move
 *   it and Space drops it.
 * - **Explicit move buttons.** The sensor is a *mode*: you have to know it
 *   exists, enter it, and hold a model of where the item is while it moves.
 *   The buttons are the same operation with none of that, and they are what a
 *   switch device or voice control can reach at all.
 *
 * The server takes the **complete** list in its new order — a partial one is
 * a 400, and `displayOrder` cannot be patched directly (D.9 · 19). So
 * `onReorder` always hands over every id.
 */

import type { ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export type SortableListProps<T> = {
  items: T[];
  getId: (item: T) => string;
  /** Names the item in the move buttons and in the drag announcements. */
  getLabel: (item: T) => string;
  /** Receives every id, in the new order. */
  onReorder: (ids: string[]) => void;
  children: (item: T) => ReactNode;
  disabled?: boolean;
};

type RowProps = {
  id: string;
  label: string;
  position: number;
  total: number;
  disabled: boolean;
  onMove: (direction: -1 | 1) => void;
  children: ReactNode;
};

function Row({ id, label, position, total, disabled, onMove, children }: RowProps) {
  const t = useTranslations('Editor.reorder');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-start gap-2 ${isDragging ? 'opacity-60' : ''}`}
    >
      <div className="flex flex-col items-center gap-0.5 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={disabled || position === 0}
          aria-label={t('moveUp', { label })}
          onClick={() => onMove(-1)}
        >
          <ChevronUp aria-hidden="true" />
        </Button>

        {/*
          The handle is the drag affordance and the keyboard sensor's entry
          point. It is a real button so it lands in the tab order — a `div`
          with listeners is reachable by mouse only.
        */}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="cursor-grab"
          disabled={disabled}
          aria-label={t('drag', { label })}
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={disabled || position === total - 1}
          aria-label={t('moveDown', { label })}
          onClick={() => onMove(1)}
        >
          <ChevronDown aria-hidden="true" />
        </Button>
      </div>

      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

export function SortableList<T>({
  items,
  getId,
  getLabel,
  onReorder,
  children,
  disabled = false,
}: SortableListProps<T>) {
  const t = useTranslations('Editor.reorder');
  const ids = items.map(getId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // A few pixels of slop, so clicking the handle's neighbours — or the
      // content itself — does not start a drag by accident.
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const labelOf = (id: string) => {
    const item = items.find((candidate) => getId(candidate) === id);
    return item ? getLabel(item) : id;
  };

  /**
   * Rule 6 applied to dragging. A drag is invisible without these: dnd-kit
   * speaks them into its own live region, and the default strings are English
   * regardless of the interface language.
   */
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('picked', { label: labelOf(String(active.id)) }),
    onDragOver: ({ active, over }) =>
      over ? t('over', { label: labelOf(String(active.id)), position: position(over.id) }) : '',
    onDragEnd: ({ active, over }) =>
      over
        ? t('dropped', { label: labelOf(String(active.id)), position: position(over.id) })
        : t('cancelled', { label: labelOf(String(active.id)) }),
    onDragCancel: ({ active }) => t('cancelled', { label: labelOf(String(active.id)) }),
  };

  function position(id: string | number) {
    return ids.indexOf(String(id)) + 1;
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;

    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;

    onReorder(arrayMove(ids, from, to));
  }

  function move(id: string, direction: -1 | 1) {
    const from = ids.indexOf(id);
    const to = from + direction;
    if (to < 0 || to >= ids.length) return;

    onReorder(arrayMove(ids, from, to));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      accessibility={{ announcements }}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-3">
          {items.map((item, index) => {
            const id = getId(item);
            return (
              <Row
                key={id}
                id={id}
                label={getLabel(item)}
                position={index}
                total={items.length}
                disabled={disabled}
                onMove={(direction) => move(id, direction)}
              >
                {children(item)}
              </Row>
            );
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
