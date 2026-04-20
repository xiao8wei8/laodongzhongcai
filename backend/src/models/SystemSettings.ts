import mongoose, { Schema, Document } from 'mongoose';

interface SystemSettings extends Document {
  basic: {
    systemName: string;
    contactPhone: string;
    contactEmail: string;
    address: string;
  };
  security: {
    passwordPolicy: string;
    loginAttempts: number;
    sessionTimeout: number;
  };
  notification: {
    enableEmail: boolean;
    enableSms: boolean;
    emailTemplate: string;
  };
  apiKeys: {
    sms: {
      secretId: string;
      secretKey: string;
      sdkAppId: string;
      signName: string;
      templateIds: {
        verification: string;
        notification: string;
        registerSuccess: string;
      };
    };
    email: {
      secretId: string;
      secretKey: string;
      sender: {
        email: string;
        name: string;
      };
      templates: {
        registerSuccess: string;
        passwordReset: string;
        caseNotification: string;
      };
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const SystemSettingsSchema = new Schema<SystemSettings>({
  basic: {
    systemName: {
      type: String,
      default: '劳动仲裁调解系统'
    },
    contactPhone: {
      type: String,
      default: '400-123-4567'
    },
    contactEmail: {
      type: String,
      default: 'support@example.com'
    },
    address: {
      type: String,
      default: '北京市朝阳区建国路88号'
    }
  },
  security: {
    passwordPolicy: {
      type: String,
      default: 'medium'
    },
    loginAttempts: {
      type: Number,
      default: 5
    },
    sessionTimeout: {
      type: Number,
      default: 24
    }
  },
  notification: {
    enableEmail: {
      type: Boolean,
      default: true
    },
    enableSms: {
      type: Boolean,
      default: false
    },
    emailTemplate: {
      type: String,
      default: '尊敬的用户，您有一条新消息：{message}'
    }
  },
  apiKeys: {
    sms: {
      secretId: {
        type: String,
        default: ''
      },
      secretKey: {
        type: String,
        default: ''
      },
      sdkAppId: {
        type: String,
        default: ''
      },
      signName: {
        type: String,
        default: ''
      },
      templateIds: {
        verification: {
          type: String,
          default: ''
        },
        notification: {
          type: String,
          default: ''
        },
        registerSuccess: {
          type: String,
          default: ''
        }
      }
    },
    email: {
      secretId: {
        type: String,
        default: ''
      },
      secretKey: {
        type: String,
        default: ''
      },
      sender: {
        email: {
          type: String,
          default: ''
        },
        name: {
          type: String,
          default: ''
        }
      },
      templates: {
        registerSuccess: {
          type: String,
          default: ''
        },
        passwordReset: {
          type: String,
          default: ''
        },
        caseNotification: {
          type: String,
          default: ''
        }
      }
    },
    tencent: {
      secretId: {
        type: String,
        default: ''
      },
      secretKey: {
        type: String,
        default: ''
      }
    },
    aliyun: {
      accessKeyId: {
        type: String,
        default: ''
      },
      accessKeySecret: {
        type: String,
        default: ''
      }
    }
  }
}, {
  timestamps: true
});

export default mongoose.model<SystemSettings>('SystemSettings', SystemSettingsSchema);