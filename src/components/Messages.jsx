// Red error and green success boxes. They show nothing when there's no message,
// so you can write <ErrorMessage>{error}</ErrorMessage> without checking first.
import { classNames } from '../lib/utils.js';

export function ErrorMessage({ children, className }) {
    if (!children) return null;
    return <p className={classNames('form-message form-error', className)} role="alert">{children}</p>;
}

export function SuccessMessage({ children }) {
    if (!children) return null;
    return <p className="form-message form-success" role="status">{children}</p>;
}
