# tree-view-click

## Description

By default, the atom tree-view for browsing files/directories will open a file or collapse / expand a directory listing just by single-clicking on the entry.

This package allows user to choose single / double click on a file to open it, or on a directory to expand/collapse it. This effectively turns a single-click into just selecting the item clicked on, which is the default behavior in most editors.

What's more, this package allow user to custom the mode of open file: pending pane or permanent pane.

## Settings

- `Allow Pending`: 'If this option and `Allow Pending Pane Items`(in core setting) are both set to true, single click will open a file in `pending pane`, otherwise open in a `permanent pane`.'
- `Open File`: Single click or double click.
- `Open Folder`: Single click or double click.

## P.S.

This package is a copy from [dbclick-tree-view](https://atom.io/packages/dbclick-tree-view), I added some enhancement to it, but I can not contact with the author to merge the pr in github. So I forked it and publish here.

## Change log

### 0.1.0
- init

### 0.1.1
- update readme

### 1.0.0
- add `Allow Pending` option.
- update setting names
- better logic to handle single click and double click

The reason adding `Allow Pending` option is that if turn off `Allow Pending Pane Items` in core setting, `github` package will keep multi blank `unstaged changes` panes open after stage. If `Allow Pending` of this package is set to false, user can open the file in permanent pane by single click and not have the blank pane problem of github package.

### 1.0.1
- update readme
