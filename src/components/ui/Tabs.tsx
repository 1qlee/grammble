import { useState, useRef } from 'react'
import {
  TabGroup,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
} from '@headlessui/react'
import { useIsomorphicLayoutEffect } from '~/hooks/useIsomorphicLayoutEffect'

type Option<T extends string> = {
  label: React.ReactNode
  value: T
  className?: string
}

type Props<T extends string> = {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  size?: 'default' | 'sm'
  shape?: 'pill' | 'circle'
  children?: React.ReactNode[]
}

export default function Tabs<T extends string>({
  options,
  value,
  onChange,
  size = 'default',
  shape = 'pill',
  children,
}: Props<T>) {
  const selectedIndex = options.findIndex((o) => o.value === value)
  const tabListRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = useState({
    left: 0,
    width: 0,
    top: 0,
    height: 0,
  })
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false })

  useIsomorphicLayoutEffect(() => {
    const list = tabListRef.current
    if (!list) return
    const update = () => {
      const tabs = list.querySelectorAll<HTMLElement>('[role="tab"]')
      const tab = tabs[selectedIndex]
      if (tab) {
        setIndicator({
          left: tab.offsetLeft,
          width: tab.offsetWidth,
          top: tab.offsetTop,
          height: tab.offsetHeight,
        })
      }
    }
    update()
    // Tab dimensions scale with CSS vars (e.g. `--tab-size`), so re-measure when
    // the list resizes, not just when the selection changes.
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(list)
    return () => observer.disconnect()
  }, [selectedIndex])

  const onMouseDown = (e: React.MouseEvent) => {
    drag.current = {
      active: true,
      startX: e.clientX,
      scrollLeft: scrollRef.current?.scrollLeft ?? 0,
      moved: false,
    }
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag.current.active || !scrollRef.current) return
    const dx = e.clientX - drag.current.startX
    if (Math.abs(dx) > 3) drag.current.moved = true
    scrollRef.current.scrollLeft = drag.current.scrollLeft - dx
  }

  const onMouseUp = () => {
    drag.current.active = false
  }

  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current.moved) {
      e.stopPropagation()
      drag.current.moved = false
    }
  }

  // Circle tabs size from `--tab-size`/`--tab-font` so they scale with the tile
  // grid; the hardcoded sm/default values act as fallbacks.
  const circleSizeFallback = size === 'sm' ? '1.75rem' : '2.25rem'
  const circleFontFallback = size === 'sm' ? '0.75rem' : '0.875rem'
  const tabStyle =
    shape === 'circle'
      ? {
          height: `var(--tab-size, ${circleSizeFallback})`,
          minWidth: `var(--tab-size, ${circleSizeFallback})`,
          fontSize: `var(--tab-font, ${circleFontFallback})`,
        }
      : undefined

  return (
    <TabGroup
      selectedIndex={selectedIndex}
      onChange={(index) => onChange(options[index].value)}
    >
      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-none"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onClickCapture={onClickCapture}
      >
        <div ref={tabListRef}>
          <TabList className={`relative flex rounded-full bg-zinc-100 items-center inset-shadow-default border border-t-zinc-300/80 border-zinc-200/50 dark:bg-zinc-800 dark:border-zinc-700/80 dark:border-t-zinc-500/50 w-fit min-w-max ${size === 'sm' ? 'p-0.5' : 'p-1'}`}>
            {indicator.width > 0 && (
              <div
                aria-hidden="true"
                className="absolute rounded-full bg-default shadow-sm transition-[left,width,top,height] duration-100"
                style={{
                  left: indicator.left,
                  width: indicator.width,
                  top: indicator.top,
                  height: indicator.height,
                }}
              />
            )}
            {options.map((option) => (
              <Tab
                key={option.value}
                style={tabStyle}
                className={`relative z-10 rounded-full border border-transparent transition-all duration-400 cursor-pointer select-none whitespace-nowrap text-zinc-500 data-selected:text-zinc-900 dark:text-zinc-400 dark:data-selected:text-zinc-100 hover:not-data-selected:opacity-80 ${shape === 'circle'
                  ? 'inline-flex items-center justify-center'
                  : size === 'sm'
                    ? 'px-3 py-0.5 text-xs'
                    : 'px-4 py-1 text-sm'
                  } ${option.className ?? ''}`}
              >
                {option.label}
              </Tab>
            ))}
          </TabList>
        </div>
      </div>
      {children && (
        <TabPanels>
          {children.map((panel, i) => (
            <TabPanel key={i} tabIndex={-1}>
              {panel}
            </TabPanel>
          ))}
        </TabPanels>
      )}
    </TabGroup>
  )
}
