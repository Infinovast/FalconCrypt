# 游戏常量定义
FLOOR = 4
ROOM_ADD = 3  # 每层房间数 = 层数 + ROOM_ADD, 4-5-6-7
XP_MAX = 8  # 经验升级要求
SKILL_POINT_MAX = 12

CHARS = [
    ('术士',   21, 8, 1, 6, 0, '神算'),
    ('圣骑士', 19, 5, 4, 5, 1, '净化'),
    ('盗贼',   20, 13, 1, 5, 0, '卷轴'),
    ('祭司',   26, 7, 1, 5, 0, '血祭'),
    ('刺客',   18, 4, 1, 4, 2, '挑衅')
]
'''格式：(name, hp, coin, def_max, food, eatk, skill)'''

ROOMS = [
    ('怪物', 'monster_event'),
    ('宝箱', 'chest_event'),
    ('陷阱', 'trap_event'),
    ('商人', 'shop_event'),
    ('篝火', 'bonfire_event'),
    ('铸锻', 'forge_event'),
    ('雕像', 'statue_event'),
    ('矿洞', 'mine_event'),
    ('BOSS', 'boss_event')
]
'''所有房间类型列表，BOSS必须放在最后一位'''

ROOMS_WEIGHT = (
    2, 1, 1, 1, 1, 1, 1, 1, 0
)
'''房间类型权重，前四种房间出现概率较高，注意与ROOMS顺序对应'''

ATTRS = {
    'hp': '❤️HP',
    'coin': '🪙Coin',
    'defense': '🛡️Def',
    'defense_max': '🛡️Def Max',
    'food': '🥖Food',
    'eatk': '🗡️ATK Extra',
    'xp': '🧠XP',
    'xp_level': '🧠XP Level',
    'scroll': '📜卷轴',
    'monster_atk': '👹Monster:🗡️ATK',
    'monster_hp': '👹Monster:❤️HP',
    'skill_point': '⚙️SP'
}
'''玩家属性字典，键为属性名，值为显示名称'''

ATTRS_TEXT = {
    'HP': '生命值',
    'coin': '金币',
    'defense': '当前防御',
    'defense_max': '最大防御',
    'food': '食物',
    'eatk': '额外攻击',
    'xp': '经验值',
    'xp_level': '经验等级',
    'scroll': '卷轴',
    'monster_atk': '怪物攻击',
    'monster_hp': '怪物生命',
    'skill_point': '技能点'
}
'''玩家属性文本描述，键为属性名，值为描述文本'''

SCROLLS = [
    ('火球术', '轰击敌人造成额外伤害'),
    ('寒冰术', '冻结敌人一回合'),
    ('治疗术', 'HP<6时疗效最佳'),
    ('隐身术', '非BOSS房可以偷偷溜走...')
]
'''卷轴列表，可以在商人处购买或在宝箱中找到'''