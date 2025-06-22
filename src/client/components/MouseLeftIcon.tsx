import React from 'react'

export function MouseLeftIcon({ size = 24 }: { size?: number | string }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
      <path
        d='M12 3C9.23858 3 7 5.23858 7 8V16C7 18.7614 9.23858 21 12 21C14.7614 21 17 18.7614 17 16V8C17 5.23858 14.7614 3 12 3Z'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <path d='M12 3V10H7' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
  )
}
