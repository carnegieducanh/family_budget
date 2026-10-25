import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.scss';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  /** Nút vuông chỉ chứa icon; phải có aria-label. */
  iconOnly?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  iconOnly = false,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    iconOnly && styles.iconOnly,
    className,
  ].filter(Boolean);
  return <button type={type} className={classes.join(' ')} {...rest} />;
}
