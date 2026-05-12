export const youdaoMockTranslate = (_text: string) => {
  console.log('youdaoMockTranslate: 不实际翻译，只是返回一个模拟结果')

  return {
    tSpeakUrl:
      'https://openapi.youdao.com/ttsapi?q=%E6%95%8F%E6%8D%B7%E7%9A%84%E6%A3%95%E8%89%B2%E7%8B%90%E7%8B%B8%E8%B7%B3%E8%BF%87%E4%BA%86%E6%87%92%E6%83%B0%E7%9A%84%E7%8B%97%E3%80%82%E5%AD%A6%E4%B9%A0%E4%B8%80%E9%97%A8%E8%AF%AD%E8%A8%80%E9%9C%80%E8%A6%81%E8%80%90%E5%BF%83%E5%92%8C%E6%8C%81%E7%BB%AD%E7%9A%84%E7%BB%83%E4%B9%A0%E3%80%82%E8%AF%95%E7%9D%80%E5%9C%A8%E4%B8%8A%E9%9D%A2%E5%92%8C%E4%B8%8B%E9%9D%A2%E9%80%89%E6%8B%A9%E5%8D%95%E4%B8%AA%E5%8D%95%E8%AF%8D%E6%88%96%E6%95%B4%E4%B8%AA%E7%9F%AD%E8%AF%AD%E3%80%82&langType=zh-CHS&sign=738B11C7B02AE3BB5EDB8B25BF4F909A&salt=1778561306254&voice=4&format=mp3&appKey=16ee9d73de526043&ttsVoiceStrict=false&osType=api',
    requestId: '1ee00308-21f3-4808-b2c9-bca20cb9afc3',
    query:
      'The quick brown fox jumps over the lazy dog. Learning a language takes patience and consistent practice. Try selecting individual words or whole phrases above and below.',
    translation: [
      '敏捷的棕色狐狸跳过了懒惰的狗。学习一门语言需要耐心和持续的练习。试着在上面和下面选择单个单词或整个短语。',
    ],
    mTerminalDict: {
      url: 'https://m.youdao.com/m/result?lang=en&word=The+quick+brown+fox+jumps+over+the+lazy+dog.+Learning+a+language+takes+patience+and+consistent+practice.+Try+selecting+individual+words+or+whole+phrases+above+and+below.',
    },
    errorCode: '0',
    dict: {
      url: 'yddict://m.youdao.com/dict?le=eng&q=The+quick+brown+fox+jumps+over+the+lazy+dog.+Learning+a+language+takes+patience+and+consistent+practice.+Try+selecting+individual+words+or+whole+phrases+above+and+below.',
    },
    webdict: {
      url: 'http://mobile.youdao.com/dict?le=eng&q=The+quick+brown+fox+jumps+over+the+lazy+dog.+Learning+a+language+takes+patience+and+consistent+practice.+Try+selecting+individual+words+or+whole+phrases+above+and+below.',
    },
    AIGC: {
      Label: '1',
      ContentProducer: '001191110108785503985K00000',
      ProduceID: '9111010878_1778561306254_3ddd2e76',
      ContentPropagator: '001191110108785503985K00000',
      PropagateID: '9111010878_1778561306254_2e463104',
      ReservedCode1: { SecurityData: [Object] },
      ReservedCode2: { SecurityData: [Object] },
    },
    l: 'en2zh-CHS',
    isWord: false,
    speakUrl:
      'https://openapi.youdao.com/ttsapi?q=The+quick+brown+fox+jumps+over+the+lazy+dog.+Learning+a+language+takes+patience+and+consistent+practice.+Try+selecting+individual+words+or+whole+phrases+above+and+below.&langType=en-USA&sign=EBBA3A3A127C1A1DD577C0F381C80F9D&salt=1778561306254&voice=4&format=mp3&appKey=16ee9d73de526043&ttsVoiceStrict=false&osType=api',
  }
}
