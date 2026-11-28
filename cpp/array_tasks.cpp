#include <array>
#include <cstddef>
#include <iomanip>
#include <iostream>
#include <string>

namespace klik {

constexpr std::size_t MAX_TASKS = 50;
constexpr std::size_t MAX_GROUPS = 32;

enum class TaskBucket {
  TERLAMBAT = 0,
  HARI_INI = 1,
  MENDATANG = 2,
  TANPA_DEADLINE = 3,
  SELESAI = 4
};

struct Task {
  std::string id;
  std::string title;
  std::string courseCode;
  long long deadlineEpochSec;
  bool hasDeadline;
  bool completed;
};

struct TaskArrayStore {
  std::array<Task, MAX_TASKS> items{};
  std::size_t count = 0;

  bool insertTask(const Task& task) {
    if (count >= MAX_TASKS) {
      return false;
    }
    items[count] = task;
    ++count;
    return true;
  }

  int findTaskIndexById(const std::string& id) const {
    for (std::size_t i = 0; i < count; ++i) {
      if (items[i].id == id) {
        return static_cast<int>(i);
      }
    }
    return -1;
  }

  bool toggleCompletion(const std::string& id) {
    const int idx = findTaskIndexById(id);
    if (idx < 0) {
      return false;
    }
    items[static_cast<std::size_t>(idx)].completed =
        !items[static_cast<std::size_t>(idx)].completed;
    return true;
  }

  bool removeTaskById(const std::string& id) {
    const int idx = findTaskIndexById(id);
    if (idx < 0) {
      return false;
    }
    for (std::size_t i = static_cast<std::size_t>(idx); i + 1 < count; ++i) {
      items[i] = items[i + 1];
    }
    --count;
    return true;
  }

  void sortByDeadline() {
    for (std::size_t i = 0; i + 1 < count; ++i) {
      std::size_t minIdx = i;
      for (std::size_t j = i + 1; j < count; ++j) {
        const Task& a = items[j];
        const Task& b = items[minIdx];

        if (!a.hasDeadline && b.hasDeadline) {
          continue;
        }
        if (a.hasDeadline && !b.hasDeadline) {
          minIdx = j;
          continue;
        }
        if (a.hasDeadline && b.hasDeadline &&
            a.deadlineEpochSec < b.deadlineEpochSec) {
          minIdx = j;
        }
      }
      if (minIdx != i) {
        const Task tmp = items[i];
        items[i] = items[minIdx];
        items[minIdx] = tmp;
      }
    }
  }

  std::size_t filterByCourse(const std::string& courseCode,
                             std::array<Task, MAX_TASKS>& outResults) const {
    std::size_t matched = 0;
    for (std::size_t i = 0; i < count; ++i) {
      if (items[i].courseCode == courseCode) {
        outResults[matched] = items[i];
        ++matched;
      }
    }
    return matched;
  }
};

TaskBucket classifyTaskBucket(const Task& task, long long nowEpochSec,
                              long long endOfTodayEpochSec) {
  if (task.completed) {
    return TaskBucket::SELESAI;
  }
  if (!task.hasDeadline) {
    return TaskBucket::TANPA_DEADLINE;
  }
  if (task.deadlineEpochSec < nowEpochSec) {
    return TaskBucket::TERLAMBAT;
  }
  if (task.deadlineEpochSec <= endOfTodayEpochSec) {
    return TaskBucket::HARI_INI;
  }
  return TaskBucket::MENDATANG;
}

const char* bucketName(TaskBucket bucket) {
  switch (bucket) {
    case TaskBucket::TERLAMBAT:
      return "Terlambat";
    case TaskBucket::HARI_INI:
      return "Hari Ini";
    case TaskBucket::MENDATANG:
      return "Mendatang";
    case TaskBucket::TANPA_DEADLINE:
      return "Tanpa Deadline";
    case TaskBucket::SELESAI:
      return "Selesai";
  }
  return "Tidak Diketahui";
}

void computeGroupCapacities(int totalParticipants, int groupCount,
                            std::array<int, MAX_GROUPS>& outCapacities,
                            int& outValidGroups) {
  if (groupCount <= 0) {
    outValidGroups = 0;
    return;
  }
  const int safeGroups =
      groupCount > static_cast<int>(MAX_GROUPS) ? static_cast<int>(MAX_GROUPS)
                                                : groupCount;
  const int safeParticipants = totalParticipants < 0 ? 0 : totalParticipants;

  const int baseCap = safeParticipants / safeGroups;
  const int remainder = safeParticipants % safeGroups;

  for (int i = 0; i < safeGroups; ++i) {
    outCapacities[static_cast<std::size_t>(i)] =
        i < remainder ? (baseCap + 1) : baseCap;
  }
  outValidGroups = safeGroups;
}

void printTasks(const TaskArrayStore& store, long long nowEpochSec,
                long long endOfTodayEpochSec) {
  std::array<int, 5> bucketTotals{};

  for (std::size_t i = 0; i < store.count; ++i) {
    const Task& t = store.items[i];
    const TaskBucket bucket =
        classifyTaskBucket(t, nowEpochSec, endOfTodayEpochSec);
    ++bucketTotals[static_cast<std::size_t>(bucket)];

    std::cout << "  [" << std::setw(4) << t.id << "] " << std::left
              << std::setw(34) << t.title << " | " << std::setw(6)
              << t.courseCode << " | " << std::setw(14) << bucketName(bucket)
              << " | " << (t.completed ? "Selesai" : "Aktif") << '\n';
  }

  std::cout << "\nRingkasan Bucket Array:\n";
  for (std::size_t b = 0; b < bucketTotals.size(); ++b) {
    std::cout << "  - " << bucketName(static_cast<TaskBucket>(b)) << ": "
              << bucketTotals[b] << '\n';
  }
}

}  // namespace klik

int main() {
  using namespace klik;

  const long long nowEpoch = 1795651200LL;        // Reference timestamp
  const long long endOfTodayEpoch = nowEpoch + 43200LL;

  TaskArrayStore store;
  store.insertTask({"T-01", "Analisis Kompleksitas Sorting", "IF302",
                    nowEpoch + 172800LL, true, false});
  store.insertTask({"T-02", "Normalisasi Skema BCNF", "IF305",
                    nowEpoch - 3600LL, true, false});
  store.insertTask({"T-03", "Implementasi Array & Stack", "IF301",
                    nowEpoch + 10800LL, true, false});
  store.insertTask({"T-04", "Review Jurnal Sistem Operasi", "IF304", 0LL, false,
                    false});
  store.insertTask({"T-05", "Latihan Routing Statis", "IF306",
                    nowEpoch + 259200LL, true, true});

  std::cout << "=== KLIK C++ Array Task Planner ===\n";
  std::cout << "Daftar awal (" << store.count << " tugas):\n";
  printTasks(store, nowEpoch, endOfTodayEpoch);

  std::cout << "\nMengurutkan array tugas berdasarkan deadline...\n";
  store.sortByDeadline();
  printTasks(store, nowEpoch, endOfTodayEpoch);

  std::cout << "\nMenandai tugas T-02 selesai...\n";
  store.toggleCompletion("T-02");

  std::array<Task, MAX_TASKS> filtered{};
  const std::size_t if302Count = store.filterByCourse("IF302", filtered);
  std::cout << "Filter mata kuliah IF302 (" << if302Count << " hasil):\n";
  for (std::size_t i = 0; i < if302Count; ++i) {
    std::cout << "  * " << filtered[i].title << '\n';
  }

  std::cout << "\nMenghapus tugas T-04 dari array...\n";
  store.removeTaskById("T-04");
  std::cout << "Jumlah tugas tersisa: " << store.count << '\n';

  std::array<int, MAX_GROUPS> groupCaps{};
  int validGroups = 0;
  computeGroupCapacities(41, 7, groupCaps, validGroups);
  std::cout << "\n=== KLIK C++ Array Group Capacity (41 peserta, 7 kelompok) ===\n";
  for (int i = 0; i < validGroups; ++i) {
    std::cout << "  Kelompok " << (i + 1) << ": maks "
              << groupCaps[static_cast<std::size_t>(i)] << " anggota\n";
  }

  return 0;
}