import { useCallback, useEffect, useState } from "react";
import Header from "../../components/layout/Header/Header";
import Sidebar from "../../components/layout/Sidebar/Sidebar";
import ScrollPanel from "../../components/layout/Scroll/ScrollPanel";
import StatisticsInfo from "../../components/common/StatisticsInfo";
import PredictionChart from "../../components/ui/PredictionChart";
import NodeMatrix from "../../components/ui/NodeMatrix";
import ChatContainer from "../../components/common/ChatContainer";
import Welcome from "../../components/features/Welcome";
import styles from "./MainPage.module.scss";
import { useAuth } from "../../auth/AuthProvider";

const MainPage = () => {
  const { profile, refreshMe } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(
    null,
  );
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  const [nodeMatrixRefreshTrigger, setNodeMatrixRefreshTrigger] = useState(0);
  const [dailyPredictedCoreHours, setDailyPredictedCoreHours] = useState<
    number | null
  >(null);

  const handlePredictionUpdated = useCallback(() => {
    setNodeMatrixRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    // 进入首页时刷新 profile，用于决定是否显示 Welcome（只在未配置/未上传时显示）
    refreshMe().catch(() => {});
  }, [refreshMe]);

  // 直接在渲染阶段计算派生状态，避免在effect中setState
  const needsSetup =
    !profile ||
    profile.has_history !== 1 ||
    profile.node_count == null ||
    profile.core_per_node == null;

  const handleCompleteConfig = async (config: {
    nodeCount: number;
    corePerNode: number;
    suggestedDate?: string;
  }) => {
    // 配置完成后刷新一次，让各组件用到最新配置/数据
    await refreshMe().catch(() => {});

    // 触发侧边栏刷新树形结构
    setSidebarRefreshTrigger((prev) => prev + 1);

    // 如果后端返回了建议的预测日期，使用它；否则选择昨天
    if (config.suggestedDate) {
      setSelectedDate(config.suggestedDate);
    } else {
      const today = new Date();
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - 1);
      setSelectedDate(targetDate.toISOString().slice(0, 10));
    }
  };

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
      <Header />
      <div className={styles["main-container"]}>
        <Sidebar
          onSelectSession={setSelectedSessionId}
          refreshTrigger={sidebarRefreshTrigger}
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
      {needsSetup && <Welcome onComplete={handleCompleteConfig} />}
    </div>
  );
};

export default MainPage;
