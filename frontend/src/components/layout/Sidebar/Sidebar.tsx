import { useEffect, useState } from "react";
import styles from "./Sidebar.module.scss";
import { BsDatabaseFill } from "react-icons/bs";
import { FaFolder, FaHistory } from "react-icons/fa";
import { fetchHistoryTree, type HistoryTreeResponse } from "../../../api";

interface OpenState {
  [key: string]: boolean;
}

interface SidebarProps {
  onSelectDate?: (date: string) => void;
  refreshTrigger?: number; // 用于触发刷新的计数器
}

const Sidebar = ({ onSelectDate, refreshTrigger }: SidebarProps) => {
  const [tree, setTree] = useState<HistoryTreeResponse | null>(null);
  const [open, setOpen] = useState<OpenState>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    fetchHistoryTree()
      .then(setTree)
      .catch(() => {
        setTree(null);
      });
  }, [refreshTrigger]); // 当 refreshTrigger 变化时重新获取树形结构

  const toggleKey = (key: string) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderTree = () => {
    if (!tree || tree.years.length === 0) {
      return (
        <li className={styles["tree-item"]}>
          <FaFolder />
          暂无数据
        </li>
      );
    }

    return tree.years.map((year) => {
      const yearKey = `y-${year.year}`;
      const yearOpen = open[yearKey] ?? true;
      return (
        <li key={yearKey} className={styles["tree-item"]}>
          <button
            type="button"
            onClick={() => toggleKey(yearKey)}
            className={styles["tree-toggle"]}
          >
            <FaFolder />
            <span>{year.year}年</span>
          </button>
          {yearOpen && (
            <ul className={styles["tree-children"]}>
              {year.months.map((month) => {
                const monthKey = `${yearKey}-m-${month.month}`;
                const monthOpen = open[monthKey] ?? false;
                return (
                  <li key={monthKey} className={styles["tree-item"]}>
                    <button
                      type="button"
                      onClick={() => toggleKey(monthKey)}
                      className={styles["tree-toggle"]}
                    >
                      <FaFolder />
                      <span>{month.month}月</span>
                    </button>
                    {monthOpen && (
                      <ul className={styles["tree-children"]}>
                        {month.days.map((day) => {
                          const dayLabel = day.date.split("-")[2];
                          const isSelected = selectedDate === day.date;
                          return (
                            <li
                              key={day.date}
                              className={styles["tree-item-leaf"]}
                            >
                              <button
                                type="button"
                                className={`${styles["tree-leaf-button"]} ${isSelected ? styles["selected"] : ""}`}
                                onClick={() => {
                                  setSelectedDate(day.date);
                                  onSelectDate?.(day.date);
                                }}
                              >
                                {dayLabel}日
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </li>
      );
    });
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles["sidebar-section"]}>
        <div className={styles["sidebar-title"]}>
          <BsDatabaseFill />
          数据详情
        </div>
        <ul className={styles["tree-view"]} id="data-tree">
          {renderTree()}
        </ul>
      </div>

      <div className={styles["sidebar-section"]}>
        <div className={styles["sidebar-title"]}>
          <FaHistory />
          对话历史
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
