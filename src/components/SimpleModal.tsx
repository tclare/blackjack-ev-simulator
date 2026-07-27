import { Divider, Modal } from "antd";
import { FC, ReactNode } from "react";

interface SimpleModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}

// Passing a real `title` puts antd's own header row (title + close "X" sharing one line) back in
// play, which is what keeps the "X" from ever overlapping body content in the first place - no
// special padding needed anywhere. `footer={null}` is what keeps these modals to "just an X", no
// footer buttons. The title itself is styled to match the bold uppercase section headers used
// elsewhere (INTRODUCTION, CASINO RULE SETTINGS, etc.), with a Divider right below it standing in
// for the space those headers used to get from a following `mb-4`/`Divider`.
export const SimpleModal: FC<SimpleModalProps> = ({ open, onClose, title, children }) => (
  <Modal
    open={open}
    onCancel={onClose}
    footer={null}
    centered
    title={title && <span className="uppercase font-bold text-sm">{title}</span>}
  >
    {title && <Divider className="mt-0 mb-4" />}
    {children}
  </Modal>
);
