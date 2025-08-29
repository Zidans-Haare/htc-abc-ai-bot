const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../hochschuhl-abc.db'),
  logging: false
});

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'editor'
  }
}, {
  tableName: 'users',
  timestamps: false
});

const HochschuhlABC = sequelize.define('HochschuhlABC', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  headline: {
    type: DataTypes.STRING,
    allowNull: false
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  editor: {
    type: DataTypes.STRING,
    allowNull: true
  },
  lastUpdated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  archived: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'hochschuhl_abc',
  timestamps: false
});

const Questions = sequelize.define('Questions', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  question: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  answer: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  user: {
    type: DataTypes.STRING,
    allowNull: true
  },
  lastUpdated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  archived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  linked_article_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'hochschuhl_abc',
      key: 'id'
    }
  },
  answered: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  spam: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  deleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  translation: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  feedback: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'questions',
  timestamps: false
});

const Feedback = sequelize.define('Feedback', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  feedback_text: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  conversation_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  attached_chat_history: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'feedback',
  timestamps: false
});

const Images = sequelize.define('Images', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    filename: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'images',
    timestamps: false
});

const UserSessions = sequelize.define('UserSessions', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    session_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    ip_address: {
        type: DataTypes.STRING,
        allowNull: true
    },
    user_agent: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    started_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    last_activity: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    questions_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    successful_answers: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    ended_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'user_sessions',
    timestamps: false
});

const ArticleViews = sequelize.define('ArticleViews', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    article_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'hochschuhl_abc',
            key: 'id'
        }
    },
    session_id: {
        type: DataTypes.STRING,
        allowNull: true
    },
    viewed_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    question_context: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'article_views',
    timestamps: false
});

const ChatInteractions = sequelize.define('ChatInteractions', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    session_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    question: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    answer: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    was_successful: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    response_time_ms: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    tokens_used: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    error_message: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'chat_interactions',
    timestamps: false
});

// Define associations
Questions.belongsTo(HochschuhlABC, { foreignKey: 'linked_article_id' });
ArticleViews.belongsTo(HochschuhlABC, { foreignKey: 'article_id' });
ChatInteractions.belongsTo(UserSessions, { foreignKey: 'session_id', targetKey: 'session_id' });

// --- New Chat History Models ---
const Conversation = sequelize.define('Conversation', {
  id: {
    type: DataTypes.TEXT,
    primaryKey: true,
  },
  anonymous_user_id: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
}, {
  tableName: 'conversations',
  timestamps: true,
  updatedAt: false,
  createdAt: 'created_at'
});

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  conversation_id: {
    type: DataTypes.TEXT,
    allowNull: false,
    references: {
      model: 'conversations',
      key: 'id',
    },
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['user', 'model']],
    },
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
}, {
  tableName: 'messages',
  timestamps: true,
  updatedAt: false,
  createdAt: 'created_at'
});

// Associations for Chat History
Conversation.hasMany(Message, { foreignKey: 'conversation_id' });
Message.belongsTo(Conversation, { foreignKey: 'conversation_id' });


// sequelize.sync({ alter: true })
//   .catch(err => console.error('SQLite sync error:', err.message));

module.exports = { sequelize, User, HochschuhlABC, Questions, Feedback, Images, UserSessions, ArticleViews, ChatInteractions, Conversation, Message };
