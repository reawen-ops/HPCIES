import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import styles from "./Welcome.module.scss";
import { FaCloudUploadAlt } from "react-icons/fa";
import { uploadHistory } from "../../api";

interface WelcomeProps {
  onComplete?: (config: {
    nodeCount: number;
    corePerNode: number;
    suggestedDate?: string;
  }) => void;
}

const Welcome = ({ onComplete }: WelcomeProps) => {
  const [fileName, setFileName] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!file || !fileName) {
      setError("请上传HPC使用数据文件");
      return;
    }

    try {
      setSubmitting(true);
      // 上传历史文件（后端会自动基于 CSV 推断节点/核数等配置）
      const result = await uploadHistory(file);
      
      // 上传成功后通知父组件，包含建议的预测日期
      onComplete?.({
        nodeCount: result.estimated_nodes || 0,
        corePerNode: result.core_per_node || 0,
        suggestedDate: result.suggested_date,
      });
    } catch (e: any) {
      console.error("提交配置失败", e);
      
      // 更详细的错误提示
      if (e.response?.status === 400) {
        setError("文件格式错误，请确保 CSV 包含正确的列（日期、小时、CPU核时使用量）");
      } else if (e.response?.status === 401) {
        setError("登录已过期，请重新登录");
      } else {
        setError("提交失败：请确认已登录且后端服务可用");
      }
    } finally {
      setSubmitting(false);
    }
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
          这是您第一次使用本系统。为了为您提供准确的预测和节能策略，请先上传您的HPC历史使用数据（CSV 文件），系统将自动推断集群规模并为您生成预测结果。
        </p>

        <form
          id="config-form"
          className={styles["config-form"]}
          onSubmit={handleSubmit}
        >
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
              disabled={submitting}
              className={styles["btn"] + " " + styles["btn-primary"]}
            >
              {submitting ? "提交中..." : "提交配置并开始分析"}
            </button>
          </div>
          {error ? (
            <div style={{ color: "#d32f2f", marginTop: 12 }}>{error}</div>
          ) : null}
        </form>
      </div>
    </div>
  );
};

export default Welcome;
