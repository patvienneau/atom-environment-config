export type ListenerFunction = (eventName: string, callback: Function, options?: Record<string ,any>) => any
export type DisposeFunction = (eventName: string, callback: Function) => any

export type TargetWithOn = { on: ListenerFunction, off: DisposeFunction }
export type TargetWithAddListener = { addListener: ListenerFunction, removeListener: DisposeFunction }
export type TargetWithAddEventListener = { addEventListener: ListenerFunction, removeEventListener: DisposeFunction }

export type Target = TargetWithOn | TargetWithAddListener | TargetWithAddEventListener
