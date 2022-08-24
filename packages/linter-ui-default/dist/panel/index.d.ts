import { CompositeDisposable } from 'atom';
import Delegate from './delegate';
import PanelDock from './dock';
import type { LinterMessage } from '../types';
export default class Panel {
    panel: PanelDock | null;
    element: HTMLElement;
    delegate: Delegate;
    messages: Array<LinterMessage>;
    deactivating: boolean;
    subscriptions: CompositeDisposable;
    showPanelConfig: boolean;
    hidePanelWhenEmpty: boolean;
    showPanelStateMessages: boolean;
    activationTimer: number;
    constructor();
    private getPanelLocation;
    activate(): Promise<void>;
    update(newMessages?: Array<LinterMessage> | null | undefined): Promise<void>;
    refresh(): Promise<void>;
    dispose(): void;
}
