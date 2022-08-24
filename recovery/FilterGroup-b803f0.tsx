import React from 'react';
import { appendClassName } from '../../utils/classNames';
import { ReactProps } from '../../utils/types';
import { FilterGroupItem } from './Item';

/**
 * The `<FilterGroup>` props.
 */
export interface FilterGroupProps extends ReactProps<'nav'> {
    /**
     * The filter group items. These should consist of one or more `<FilterGroup.Item>` elements.
     */
     readonly children?: React.ReactNode;
}

/**
 * The `<FilterGroup>` component renders a container for filter items.
 */
export const FilterGroup = Object.assign(
    React.forwardRef(function FilterGroup(
        { children, ...props }: FilterGroupProps,
        ref: React.Ref<HTMLElement>,
    ) {
        return (
            <nav
                ref={ref}
                {...props}
                className={appendClassName('c-filter-group', props.className)}
            >
                <ul className="c-filter-group__list">{children}</ul>
            </nav>
        );
    }),
    { Item: FilterGroupItem },
);
