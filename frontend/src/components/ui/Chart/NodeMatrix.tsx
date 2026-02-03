import styles from "./NodeMatrix.module.scss";

interface NodeMatrixProps {
  nodeCount: number;
}

const MAX_DISPLAY_NODES = 128;

const NodeMatrix = ({ nodeCount }: NodeMatrixProps) => {
  const displayCount = Math.min(Math.max(nodeCount, 0), MAX_DISPLAY_NODES);

  const nodes = Array.from({ length: displayCount }, (_, index) => {
    const id = index + 1;
    const random = Math.random();
    let statusClass = styles["node-running"];

    if (random >= 0.5 && random < 0.7) {
      statusClass = styles["node-sleeping"];
    } else if (random >= 0.7) {
      statusClass = styles["node-to-sleep"];
    }

    return {
      id,
      statusClass,
    };
  });

  return (
    <div className={styles["node-matrix"]}>
      <div className={styles["matrix-title"]}>当前建议运行状态</div>
      <div className={styles.legend}>
        <div className={styles["legend-item"]}>
          <div
            className={`${styles.node} ${styles["node-running"]}`}
            aria-hidden="true"
          />
          <span>必须运行 (绿色)</span>
        </div>
        <div className={styles["legend-item"]}>
          <div
            className={`${styles.node} ${styles["node-sleeping"]}`}
            aria-hidden="true"
          />
          <span>休眠 (红色)</span>
        </div>
        <div className={styles["legend-item"]}>
          <div
            className={`${styles.node} ${styles["node-to-sleep"]}`}
            aria-hidden="true"
          />
          <span>待休眠 (黄色)</span>
        </div>
      </div>
      <div className={styles["matrix-grid"]}>
        {nodes.map((node) => (
          <div
            key={node.id}
            className={`${styles.node} ${node.statusClass}`}
          >
            {node.id}
          </div>
        ))}
      </div>
    </div>
  );
};

export default NodeMatrix;


