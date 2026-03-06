import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import styles from "./Welcome.module.scss";
import { FaCloudUploadAlt } from "react-icons/fa";
import { updateClusterConfig, uploadHistory } from "../../api";

interface WelcomeProps {
  onComplete?: (config: { nodeCount: number; corePerNode: number }) => void;
}

const Welcome = ({ onComplete }: WelcomeProps) => {
  const [nodeCount, setNodeCount] = useState<string>("");
  const [corePerNode, setCorePerNode] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!file || !fileName) {
      // 与原始页面保持一致：要求先上传文件

      alert("请上传HPC使用数据文件");
      return;
    }

    const parsedNodeCount = Number.parseInt(nodeCount, 10) || 0;
    const parsedCorePerNode = Number.parseInt(corePerNode, 10) || 0;

    try {
      // 1. 上传历史文件
      await uploadHistory(file);
    } catch (e) {
      console.error("上传历史数据失败", e);
      // 继续执行，即使失败也让用户进入应用
    }

    updateClusterConfig({
      node_count: parsedNodeCount,
      core_per_node: parsedCorePerNode,
    })
      .catch(() => {
        // 后端不可用时，仅关闭弹窗
      })
      .finally(() => {
        onComplete?.({
          nodeCount: parsedNodeCount,
          corePerNode: parsedCorePerNode,
        });
      });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const f = event.target.files?.[0] || null;
    if (f) {
      setFileName(f.name);
      setFile(f);
    } else {
      setFileName("");
      setFile(null);
    }
  };

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={styles["welcome-modal"]}>
      <div className={styles["welcome-content"]}>
        <h2 className={styles["welcome-title"]}>欢迎使用HPC能源管家</h2>
        <p className={styles["welcome-text"]}>
          这是您第一次使用本系统。为了为您提供准确的预测和节能策略，请先配置您的HPC集群基本信息并上传历史使用数据。
        </p>

        <form
          id="config-form"
          className={styles["config-form"]}
          onSubmit={handleSubmit}
        >
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
                min={1}
                value={nodeCount}
                onChange={(e) => setNodeCount(e.target.value)}
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
                min={1}
                value={corePerNode}
                onChange={(e) => setCorePerNode(e.target.value)}
              />
            </div>
          </div>

          <div className={styles["form-group"]}>
            <label className={styles["form-label"]}>
              上传HPC使用数据 (.csv文件)
            </label>
            <div
              className={styles["file-upload"]}
              id="file-upload-area"
              onClick={handleClickUpload}
            >
              <FaCloudUploadAlt />
              <p>点击或将文件拖拽到此处上传</p>
              <p className={styles["file-info"]}>
                支持CSV格式，包含日期、小时、CPU核时使用量、内存GB时使用量等字段
              </p>
            </div>
            <input
              ref={fileInputRef}
              title="请选择一个文件"
              type="file"
              id="file-input"
              accept=".csv"
              className={styles["hidden"]}
              onChange={handleFileChange}
            />
            <div id="file-name" className={styles["file-info"]}>
              {fileName ? `已选择文件: ${fileName}` : ""}
            </div>
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
