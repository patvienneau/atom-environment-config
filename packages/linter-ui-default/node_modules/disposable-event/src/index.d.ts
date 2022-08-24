import { Disposable } from 'event-kit'
import { Target } from "./target"

declare function disposableEvent(target: Target, eventName: string, callback: Function, options?: Record<string, any>): Disposable

export = disposableEvent
