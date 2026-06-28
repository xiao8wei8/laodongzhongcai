Page({
  data: {
    type: 'service',
    title: '用户服务协议',
    sections: []
  },

  onLoad(options) {
    const type = options.type === 'privacy' ? 'privacy' : 'service';
    const contentMap = {
      service: {
        title: '用户服务协议',
        sections: [
          { title: '服务说明', content: '本小程序提供劳动争议调解申请、咨询、案件查询、消息通知等服务。你可以在未登录状态下浏览公开信息与服务说明。' },
          { title: '账号使用', content: '当你选择登录后，需要按页面提示完成身份确认与街道选择。请妥善保管你的账号信息，不得冒用他人身份。' },
          { title: '信息真实', content: '提交申请、咨询或资料时，请确保姓名、手机号、身份证号及案件信息真实、准确、完整。' },
          { title: '服务边界', content: '平台提供调解相关的信息化支持，具体案件处理结果以实际调解、仲裁及相关法定程序为准。' }
        ]
      },
      privacy: {
        title: '隐私政策',
        sections: [
          { title: '收集范围', content: '仅在你主动登录、提交调解申请、发起咨询、完善资料或上传材料时，收集必要的身份信息、联系方式、案件信息和你主动提供的资料。' },
          { title: '使用目的', content: '收集的信息仅用于身份识别、案件受理、咨询回复、消息通知、资料展示及相关服务优化，不会超出上述目的擅自使用。' },
          { title: '你的选择权', content: '你可以先浏览小程序公开功能，再自行决定是否登录。是否勾选同意协议由你自主选择，不勾选则不会触发登录授权。' },
          { title: '信息保护', content: '我们会采取合理措施保护你的个人信息安全；如你希望更正、更新或删除你主动提交的信息，可在登录后通过个人资料或联系客服处理。' }
        ]
      }
    };

    this.setData({
      type,
      title: contentMap[type].title,
      sections: contentMap[type].sections
    });
    wx.setNavigationBarTitle({ title: contentMap[type].title });
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  }
});
