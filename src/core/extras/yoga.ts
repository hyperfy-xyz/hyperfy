import Yoga from 'yoga-layout'

export const Display: Record<string, any> = {}
export const FlexDirection: Record<string, any> = {}
export const JustifyContent: Record<string, any> = {}
export const AlignItems: Record<string, any> = {}
export const AlignContent: Record<string, any> = {}
export const FlexWrap: Record<string, any> = {}

// setup globals after Yoga wasm loaded
export const initYoga = () => {
  Display['flex'] = Yoga.DISPLAY_FLEX
  Display['none'] = Yoga.DISPLAY_NONE
  FlexDirection['column'] = Yoga.FLEX_DIRECTION_COLUMN
  FlexDirection['column-reverse'] = Yoga.FLEX_DIRECTION_COLUMN_REVERSE
  FlexDirection['row'] = Yoga.FLEX_DIRECTION_ROW
  FlexDirection['row-reverse'] = Yoga.FLEX_DIRECTION_ROW_REVERSE
  JustifyContent['flex-start'] = Yoga.JUSTIFY_FLEX_START
  JustifyContent['flex-end'] = Yoga.JUSTIFY_FLEX_END
  JustifyContent['center'] = Yoga.JUSTIFY_CENTER
  JustifyContent['space-between'] = Yoga.JUSTIFY_SPACE_BETWEEN
  JustifyContent['space-around'] = Yoga.JUSTIFY_SPACE_AROUND
  JustifyContent['space-evenly'] = Yoga.JUSTIFY_SPACE_EVENLY
  AlignItems['stretch'] = Yoga.ALIGN_STRETCH
  AlignItems['flex-start'] = Yoga.ALIGN_FLEX_START
  AlignItems['flex-end'] = Yoga.ALIGN_FLEX_END
  AlignItems['center'] = Yoga.ALIGN_CENTER
  AlignItems['baseline'] = Yoga.ALIGN_BASELINE
  AlignContent['flex-start'] = Yoga.ALIGN_FLEX_START
  AlignContent['flex-end'] = Yoga.ALIGN_FLEX_END
  AlignContent['stretch'] = Yoga.ALIGN_STRETCH
  AlignContent['center'] = Yoga.ALIGN_CENTER
  AlignContent['space-between'] = Yoga.ALIGN_SPACE_BETWEEN
  AlignContent['space-around'] = Yoga.ALIGN_SPACE_AROUND
  AlignContent['space-evenly'] = Yoga.ALIGN_SPACE_EVENLY
  FlexWrap['no-wrap'] = Yoga.WRAP_NO_WRAP
  FlexWrap['wrap'] = Yoga.WRAP_WRAP
  FlexWrap['wrap-reverse'] = Yoga.WRAP_WRAP_REVERSE
}

const displays = ['flex', 'none']

export function isDisplay(value: unknown): boolean {
  return displays.includes(value as string)
}

const flexDirections = ['column', 'column-reverse', 'row', 'row-reverse', 'flex-start', 'flex-end', 'center']

export function isFlexDirection(value: unknown): boolean {
  return flexDirections.includes(value as string)
}

const justifyContents = ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly']

export function isJustifyContent(value: unknown): boolean {
  return justifyContents.includes(value as string)
}

const alignItems = ['stretch', 'flex-start', 'flex-end', 'center', 'baseline']

export function isAlignItem(value: unknown): boolean {
  return alignItems.includes(value as string)
}

const alignContents = ['flex-start', 'flex-end', 'stretch', 'center', 'space-between', 'space-around', 'space-evenly']

export function isAlignContent(value: unknown): boolean {
  return alignContents.includes(value as string)
}

const flexWraps = ['no-wrap', 'wrap', 'wrap-reverse']

export function isFlexWrap(value: unknown): boolean {
  return flexWraps.includes(value as string)
}
