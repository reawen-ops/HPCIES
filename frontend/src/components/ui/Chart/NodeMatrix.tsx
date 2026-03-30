import { useEffect, useState } from "react";
import { fetchNodeMatrix, type NodeMatrixResponse } from "../../../api";
import styles from "./NodeMatrix.module.scss";

interface NodeMatrixProps {
  refreshTrigger?: number;
}

const NodeMatrix = ({ refreshTrigger }: NodeMatrixProps) => {
  const [data, setData] = useState<NodeMatrixResponse | null>(null);

  useEffect(() => {
    fetchNodeMatrix()
      .then(setData)
      .catch(() => {
        // 后端不可用时保持为空
      });
  }, [refreshTrigger]);

  return (
    <div className={styles["node-matrix"]}>
      <div className={styles["matrix-title"]}>当前建议运行状态</div>
      <div className={styles.legend}>
        <div className={styles["legend-item"]}>
          <div
            className={`${styles.node} ${styles["node-running"]}`}
            aria-hidden="true"
          />
          <span>运行 (绿色)</span>
        </div>
        <div className={styles["legend-item"]}>
          <div
            className={`${styles.node} ${styles["node-sleeping"]}`}
            aria-hidden="true"
          />
          <span>关机 (红色)</span>
        </div>
        <div className={styles["legend-item"]}>
          <div
            className={`${styles.node} ${styles["node-to-sleep"]}`}
            aria-hidden="true"
          />
          <span>待机 (黄色)</span>
        </div>
      </div>
      <div className={styles["matrix-grid"]}>
        {data?.nodes.map((node) => {
          let statusClass = styles["node-running"];
          if (node.status === "sleeping") {
            statusClass = styles["node-sleeping"];
          } else if (node.status === "to_sleep") {
            statusClass = styles["node-to-sleep"];
          }

          return (
            <div key={node.node_id} className={`${styles.node} ${statusClass}`}>
              {node.node_id}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NodeMatrix;
