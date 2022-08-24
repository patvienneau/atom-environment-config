import React, { useEffect } from 'react';
import { useFocusVisible } from '../../../hooks/useFocusVisible';
import { prependClassName } from '../../../utils/classNames';
import { ElementProps } from '../../../utils/types';
import { InputProps } from '../../Input/phoenix/Input';
import { Label } from '../../Label/phoenix/Label';
import { Text } from '../../Text/phoenix/Text';

/**
 * All props for native HTMLInputElement
 */
type HTMLRadioProps = React.DetailedHTMLProps<
    React.InputHTMLAttributes<HTMLInputElement>,
    HTMLInputElement
>;

/**
 * Properties of radio button component
 */
export interface RadioProps extends InputProps {
    /**
     * htmlFor attribute for input label
     */
    htmlFor?: string;
}

/**
 * Radio input component.
 */
export const Radio = React.forwardRef(function Radio(
    {
        className,
        children,
        note,
        hasErrors,
        isDisabled,
        disabled,
        isRequired,
        htmlFor,
        ...props
    }: RadioProps & HTMLRadioProps,
    ref: React.Ref<HTMLInputElement>,
) {
    useEffect(() => {
        console.warn(`[UNMOUNT] Radio (${props.title})`)

        return () => {
            console.warn(`[UNMOUNT] Radio (${props.title})`)
        }
    })

    if (isDisabled !== undefined) {
        if (process.env.NODE_ENV !== 'production') {
            console.warn(
                `DEPRECATION NOTICE: Using 'isDisabled' prop for <Input> components is deprecated. Please use 'disabled' instead.`,
            );
            if (disabled !== undefined) {
                console.warn(
                    `Both 'disabled' and 'isDisabled' props are used on the same <Input> component. The 'isDisabled' is ignored.`,
                );
            }
        }
        if (disabled === undefined) {
            disabled = isDisabled;
        }
    }

    const { isFocusVisible, onBlur, onFocus } = useFocusVisible<HTMLInputElement>(props);
    const hasNote = typeof note === 'string' && note.length > 0;
    const itemClass = prependClassName(
        {
            'c-radio': true,
            'is-focus-visible': isFocusVisible,
            'c-radio--with-note': hasNote,
            'c-radio--disabled': disabled ?? false,
            'c-radio--checked': props.checked ?? false,
        },
        className,
    );

    return (
        <Label as="label" color="brand-500" style="default" className={itemClass}>
            <input
                {...(props as ElementProps<'input'>)}
                ref={ref}
                className="c-radio__input"
                disabled={disabled || (!props.checked && props.readOnly)}
                onBlur={onBlur}
                onFocus={onFocus}
                type="radio"
            />
            <span className="c-radio__checkmark" />
            <span className="c-radio__label">{children}</span>
            {hasNote ? (
                <Text className="c-radio__note" as="p">
                    {note}
                </Text>
            ) : null}
        </Label>
    );
});

export default Radio;
