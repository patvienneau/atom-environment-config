'use babel';
/* globals atom */
import { CompositeDisposable } from 'atom';
import { name as packageName } from '../package.json';

const config = {};
export default {
    config: {
        allowPending: {
            type: 'boolean',
            default: true,
            description: 'If this option and `Allow Pending Pane Items`(in core setting) are both set to true, single click will open a file in `pending pane`, otherwise open in a `permanent pane`.',
        },
        openFile: {
            type: 'string',
            default: 'singleClick',
            enum: [
                {
                    value: 'singleClick',
                    description: 'Single Click',
                }, {
                    value: 'doubleClick',
                    description: 'Double Click',
                },
            ],
            description: 'Single or Double click to open file.',
        },
        openFolder: {
            type: 'string',
            default: 'doubleClick',
            enum: [
                {
                    value: 'singleClick',
                    description: 'Single Click',
                }, {
                    value: 'doubleClick',
                    description: 'Double Click',
                },
            ],
            description: 'Single or Double click to open a folder.',
        },
    },
    observeConfig() {
        Object.keys(this.config).forEach((key) => {
            atom.config.observe(`${packageName}.${key}`, (value) => {
                config[key] = value;
            });
        });
    },
    activate(state) {
        this.observeConfig(['allowPending', 'openFile', 'openFolder']);
        return atom.packages.activatePackage('tree-view').then((treeViewPkg) => {
            if (treeViewPkg.mainModule.createView) {
                this.treeView = treeViewPkg.mainModule.createView();
            } else {
                this.treeView = treeViewPkg.mainModule.getTreeViewInstance();
            }
            this.treeView.originalEntryClicked = this.treeView.entryClicked.bind(this.treeView);
            this.treeView.entryClicked = (e) => {
                const entry = e.target.closest('.entry');
                if (!entry) {
                    return;
                }
                if (e.detail == 1) {
                    this.onEntrySingleClick(e);
                } else if (e.detail == 2) {
                    this.onEntryDoubleClick(e);
                }
            };
        });
    },
    onEntrySingleClick(e) {
        const entry = e.target.closest('.entry');
        const isRecursive = e.altKey || false;
        if (this.isFile(entry) && config.openFile === 'singleClick') {
            if (this.isPendingPaneAllowed()) {
                return this.treeView.fileViewEntryClicked(e);
            }
            this.treeView.selectEntry(entry);
            this.treeView.openSelectedEntry();
            return;
        }
        if (this.isDirectory(entry)) {
            this.treeView.selectEntry(entry);
            if (
                this.isClickOnArrow(e)
                || config.openFolder === 'singleClick'
            ) {
                entry.toggleExpansion(isRecursive);
            }
        }
    },
    onEntryDoubleClick(e) {
        const entry = e.target.closest('.entry');
        const isRecursive = e.altKey || false;
        if (this.isDirectory(entry) && config.openFolder === 'doubleClick') {
            entry.toggleExpansion(isRecursive);
        }
        if (this.isFile(entry) && config.openFile === 'doubleClick') {
            this.treeView.fileViewEntryClicked(e);
        }
    },
    isPendingPaneAllowed() {
        return atom.config.get('core.allowPendingPaneItems')
            && config.allowPending;
    },
    isDirectory(entry) {
        return entry.classList.contains('directory');
    },
    isFile(entry) {
        return entry.classList.contains('file');
    },
    isClickOnArrow(e) {
        return e.offsetX <= 10;
    },
    deactivate() {
        this.treeView.entryClicked = this.treeView.originalEntryClicked;
        delete this.treeView.originalEntryClicked;
    },
};
