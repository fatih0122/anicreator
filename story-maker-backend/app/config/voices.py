"""
Voice Configuration for TTS
Maps display names to Supertone voice IDs and provides preview scripts
"""

VOICE_LIBRARY = {
    "준호": {
        "voice_id": "ab7cd18e645b54d7536e0f",
        "original_name": "dohyun",
        "display_name": "준호",
        "preview_script": "어느 화창한 아침, 모모는 창가에 앉아 밖을 바라보았어요. 새들이 노래하고 나비들이 춤을 추는 아름다운 정원이 펼쳐져 있었죠.",
        "preview_url": "https://stobee.s3.us-east-2.amazonaws.com/voice_previews/준호.mp3"
    },
    "소피아": {
        "voice_id": "845463cfe40f4ee369f417",
        "original_name": "Reigna Belle",
        "display_name": "소피아",
        "preview_script": "숲 속 깊은 곳에 반짝이는 호수가 있었어요. 호수 한가운데에는 신비로운 빛을 내는 작은 섬이 떠 있었죠.",
        "preview_url": "https://stobee.s3.us-east-2.amazonaws.com/voice_previews/소피아.mp3"
    },
    "민석": {
        "voice_id": "cbf21a60b4fbd048df6508",
        "original_name": "jinha",
        "display_name": "민석",
        "preview_script": "하늘 높이 떠 있는 구름 위에 마법의 성이 있었어요. 성 안에는 오래된 책들이 가득했고, 각각의 책은 특별한 이야기를 간직하고 있었죠.",
        "preview_url": "https://stobee.s3.us-east-2.amazonaws.com/voice_previews/민석.mp3"
    },
    "엠마": {
        "voice_id": "084714312eb4ec06fbfe51",
        "original_name": "Tilly",
        "display_name": "엠마",
        "preview_script": "작은 마을에 마법 가게가 새로 생겼어요! 가게 안에는 반짝이는 별가루와 형형색색의 물약들이 가득했죠.",
        "preview_url": "https://stobee.s3.us-east-2.amazonaws.com/voice_previews/엠마.mp3"
    },
    "지아": {
        "voice_id": "427bbfa89704dfba8feed4",
        "original_name": "kaori",
        "display_name": "지아",
        "preview_script": "달빛이 비추는 밤, 정원에는 은은한 향기가 퍼져 있었어요. 꽃들은 조용히 잠들어 있었고, 반딧불이들만이 빛을 내고 있었죠.",
        "preview_url": "https://stobee.s3.us-east-2.amazonaws.com/voice_previews/지아.mp3"
    },
    "라이언": {
        "voice_id": "32d43349abb5df0c414df1",
        "original_name": "Evan",
        "display_name": "라이언",
        "preview_script": "높은 산 정상에 올라선 토비는 크게 소리쳤어요. '야호!' 산 아래로 펼쳐진 넓은 세상이 한눈에 들어왔죠.",
        "preview_url": "https://stobee.s3.us-east-2.amazonaws.com/voice_previews/라이언.mp3"
    },
    "태민": {
        "voice_id": "ff700760946618e1dcf7bd",
        "original_name": "Garret",
        "display_name": "태민",
        "preview_script": "오래된 도서관의 먼지 쌓인 책장 뒤에 비밀의 문이 숨겨져 있었어요. 문을 열자 긴 계단이 아래로 이어졌죠.",
        "preview_url": "https://stobee.s3.us-east-2.amazonaws.com/voice_previews/태민.mp3"
    },
    "제임스": {
        "voice_id": "95be956023597487733bbb",
        "original_name": "Watson",
        "display_name": "제임스",
        "preview_script": "옛날 옛적, 마을에는 모든 것을 아는 현명한 할아버지가 살고 계셨어요. 아이들은 궁금한 것이 있을 때마다 할아버지를 찾아갔죠.",
        "preview_url": "https://stobee.s3.us-east-2.amazonaws.com/voice_previews/제임스.mp3"
    },
    "채원": {
        "voice_id": "39f27eaab088024ff6f9ac",
        "original_name": "Cindy",
        "display_name": "채원",
        "preview_script": "따뜻한 햇살이 비추는 오후, 엄마와 함께 공원을 산책했어요. 바람에 흔들리는 나뭇잎들과 멀리서 들려오는 새소리가 마음을 편안하게 해주었죠.",
        "preview_url": "https://stobee.s3.us-east-2.amazonaws.com/voice_previews/채원.mp3"
    },
    "우진": {
        "voice_id": "b442bc1df74c7575f581ab",
        "original_name": "Jungsok",
        "display_name": "우진",
        "preview_script": "장난꾸러기 다람쥐 코코는 오늘도 숲 속을 이리저리 뛰어다니고 있었어요. 도토리를 찾다가 친구 토끼를 만나면 '안녕!' 하고 인사를 건넸죠.",
        "preview_url": "https://stobee.s3.us-east-2.amazonaws.com/voice_previews/우진.mp3"
    }
}

def get_voice_by_id(voice_id: str):
    """Get voice configuration by Supertone voice ID"""
    for name, config in VOICE_LIBRARY.items():
        if config["voice_id"] == voice_id:
            return config
    return None

def get_voice_by_name(display_name: str):
    """Get voice configuration by display name"""
    return VOICE_LIBRARY.get(display_name)

def get_all_voices():
    """Get list of all available voices"""
    return [
        {
            "voice_id": config["voice_id"],
            "original_name": config["original_name"],
            "display_name": config["display_name"],
            "preview_script": config["preview_script"],
            "preview_url": config["preview_url"]
        }
        for config in VOICE_LIBRARY.values()
    ]

def get_preview_script(voice_name: str) -> str:
    """Get preview script for a voice"""
    voice = VOICE_LIBRARY.get(voice_name)
    if voice:
        return voice["preview_script"]
    return ""
