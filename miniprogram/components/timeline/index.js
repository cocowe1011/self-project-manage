// components/timeline/index.js
Component({
  properties: {
    logs: {
      type: Array,
      value: [],
    },
  },

  methods: {
    formatTime(date) {
      if (!date) return "";
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hour = String(d.getHours()).padStart(2, "0");
      const minute = String(d.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day} ${hour}:${minute}`;
    },

    getLogTypeClass(type) {
      const typeMap = {
        "项目建立": "type-create",
        "收到入款": "type-income",
        "项目进度变更": "type-status",
      };
      return typeMap[type] || "type-default";
    },

    getLogTypeIcon(type) {
      const iconMap = {
        "项目建立": "📁",
        "收到入款": "💰",
        "项目进度变更": "🔄",
      };
      return iconMap[type] || "📌";
    },
  },
});
