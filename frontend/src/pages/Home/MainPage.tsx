import { useCallback, useEffect, useState } from "react";
import Header from "../../components/layout/Header/Header";
import Sidebar from "../../components/layout/Sidebar/Sidebar";
import ScrollPanel from "../../components/layout/Scroll/ScrollPanel";
import StatisticsInfo from "../../components/common/StatisticsInfo";
import PredictionChart from "../../components/ui/PredictionChart";
import NodeMatrix from "../../components/ui/NodeMatrix";
import ChatContainer from "../../components/common/ChatContainer";
import styles from "./MainPage.module.scss";
import { useAuth } from "../../auth/AuthProvider";

const MainPage = () => {
  const { profile, refreshMe } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>("2025-11-01");
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(
    null,
  );
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  const [nodeMatrixRefreshTrigger, setNodeMatrixRefreshTrigger] = useState(0);
  const [dailyPredictedCoreHours, setDailyPredictedCoreHours] = useState<
    number | null
  >(null);
  const [showDataNotice, setShowDataNotice] = useState(
    () => window.sessionStorage.getItem("show-data-source-notice") === "1",
  );
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handlePredictionUpdated = useCallback(() => {
    setNodeMatrixRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    // 进入首页时刷新 profile，用于决定是否显示 Welcome（只在未配置/未上传时显示）
    refreshMe().catch(() => {});
  }, [refreshMe]);

  useEffect(() => {
    if (showDataNotice) {
      window.sessionStorage.removeItem("show-data-source-notice");
    }
  }, [showDataNotice]);

  const avgUtilizationPercent =
    dailyPredictedCoreHours != null &&
    profile?.node_count != null &&
    profile?.core_per_node != null &&
    profile.node_count > 0 &&
    profile.core_per_node > 0
      ? (dailyPredictedCoreHours /
          (profile.node_count * profile.core_per_node * 24)) *
        100
      : null;

  return (
    <div>
      <Header
        collapsed={isHeaderCollapsed}
        onToggleCollapse={() => setIsHeaderCollapsed((prev) => !prev)}
      />
      <div
        className={`${styles["main-container"]} ${isHeaderCollapsed ? styles["main-container-header-collapsed"] : ""}`}
      >
        <Sidebar
          onSelectSession={setSelectedSessionId}
          refreshTrigger={sidebarRefreshTrigger}
          collapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />
        <div className={styles["content-area"]}>
          <ScrollPanel>
            <StatisticsInfo avgUtilizationPercent={avgUtilizationPercent} />
            <PredictionChart
              selectedDate={selectedDate}
              onChangeDate={setSelectedDate}
              onPredictionUpdated={handlePredictionUpdated}
              onDailyPredictedCoreHoursChange={setDailyPredictedCoreHours}
            />
            <NodeMatrix refreshTrigger={nodeMatrixRefreshTrigger} />
            <ChatContainer
              selectedSessionId={selectedSessionId}
              contextDate={selectedDate}
              onChatUpdated={() => setSidebarRefreshTrigger((prev) => prev + 1)}
            />
          </ScrollPanel>
        </div>
      </div>
      {showDataNotice && (
        <div className={styles["notice-modal"]} role="dialog" aria-modal="true">
          <div className={styles["notice-content"]}>
            <h3>提示</h3>
            <p>
              本系统所用数据均来自华北电力大学高性能计算平台的真实数据，当前系统仅用于演示。
            </p>
            <button
              type="button"
              className={styles["notice-button"]}
              onClick={() => setShowDataNotice(false)}
            >
              我已知晓
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainPage;
