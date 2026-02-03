import { type ReactNode } from "react";
import styles from "./ScrollPanel.module.scss";

interface ScrollPanelProps {
  children: ReactNode;
}

const ScrollPanel = ({ children }: ScrollPanelProps) => {
  return <div className={styles["content-scroll-panel"]}>{children}</div>;
};

export default ScrollPanel;
