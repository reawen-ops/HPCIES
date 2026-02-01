import styles from "./welcome.module.scss";
import { FaCloudUploadAlt } from "react-icons/fa";

const Welcome = () => {
  return (
    <div id="welcome-modal" className={styles["welcome-modal"]}>
      <div className={styles["welcome-content"]}>
        <h2 className={styles["welcome-title"]}>欢迎使用HPC能源管家</h2>
        <p className={styles["welcome-text"]}>
          这是您第一次使用本系统。为了为您提供准确的预测和节能策略，请先配置您的HPC集群基本信息并上传历史使用数据。
        </p>

        <form id="config-form" className={styles["config-form"]}>
          <div className={styles["config-row"]}>
            <div className={styles["config-group"]}>
              <label className={styles["form-label"]} htmlFor="node-count">
                节点数
              </label>
              <input
                type="number"
                id="node-count"
                className={styles["form-control"]}
                placeholder="例如：128"
                required
                min="1"
              />
            </div>

            <div className={styles["config-group"]}>
              <label className={styles["form-label"]} htmlFor="core-per-node">
                每节点核数
              </label>
              <input
                type="number"
                id="core-per-node"
                className={styles["form-control"]}
                placeholder="例如：32"
                required
                min="1"
              />
            </div>
          </div>

          <div className={styles["form-group"]}>
            <label className={styles["form-label"]}>
              上传HPC使用数据 (.csv文件)
            </label>
            <div className={styles["file-upload"]} id="file-upload-area">
              <FaCloudUploadAlt />
              <p>点击或将文件拖拽到此处上传</p>
              <p className={styles["file-info"]}>
                支持CSV格式，包含日期、小时、CPU核时使用量、内存GB时使用量等字段
              </p>
            </div>
            <input
              title="请选择一个文件"
              type="file"
              id="file-input"
              accept=".csv"
              className={styles["hidden"]}
            />
            <div id="file-name" className={styles["file-info"]}></div>
          </div>

          <div className={styles["config-btn"]}>
            <button
              type="submit"
              className={styles["btn"] + " " + styles["btn-primary"]}
            >
              提交配置并开始分析
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Welcome;
