import React, { memo } from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';

function GroupNode({ data, selected }) {
  return (
    <>
      <NodeResizer
        color="#3b82f6"
        isVisible={selected}
        minWidth={200}
        minHeight={150}
      />
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          padding: '20px',
          pointerEvents: 'none', // Allow clicks to pass through to nodes underneath
        }}
      >
        <div
          style={{
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#9ca3af',
            opacity: selected ? 1 : 0.5,
            backgroundColor: selected ? 'rgba(249, 250, 251, 0.95)' : 'rgba(249, 250, 251, 0.7)',
            padding: '4px 12px',
            borderRadius: '4px',
            pointerEvents: 'auto', // Label can still be clicked
          }}
        >
          {data.label}
        </div>
        {data.description && selected && (
          <div
            style={{
              fontSize: '11px',
              color: '#9ca3af',
              marginTop: '4px',
              backgroundColor: 'rgba(249, 250, 251, 0.95)',
              padding: '2px 8px',
              borderRadius: '3px',
              pointerEvents: 'auto',
            }}
          >
            {data.description}
          </div>
        )}
      </div>
    </>
  );
}

export default memo(GroupNode);
