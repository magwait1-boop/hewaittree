'use client';

import React, { useEffect, useId, useRef } from 'react';
import TreeSidebar from './TreeSidebar';

interface Props extends React.ComponentProps<typeof TreeSidebar> {
  isOpen: boolean;
}

export default function PersonDetailsModal({ isOpen, ...details }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const { nodeId, personMap, onClose } = details;
  const person = nodeId ? personMap.get(nodeId) : null;

  useEffect(() => {
    if (!isOpen || !person) return;
    panelRef.current?.querySelector<HTMLButtonElement>('button[data-details-close]')?.focus({ preventScroll: true });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, person?.id, onClose]);

  if (!isOpen || !person) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className="person-details-sheet no-print"
    >
      <div aria-hidden="true" className="flex h-5 flex-shrink-0 items-center justify-center sm:hidden">
        <span className="h-1 w-10 rounded-full bg-white/25" />
      </div>
      <TreeSidebar {...details} compact titleId={titleId} />
    </div>
  );
}
