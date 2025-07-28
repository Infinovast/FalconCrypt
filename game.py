import os
from consts import *
from random import choices, randint, sample, random

class Game:
    def __init__(self):
        # 玩家属性
        self.hp = 0
        self.coin = 0
        self.defense = 0  # 当前防御
        self.defense_max = 0  # 最大防御
        self.food = 0
        self.eatk = 0  # 额外攻击力
        self.skill = ''  # 角色技能
        self.xp = 0
        self.xp_level = 1
        self.has_falcon = False
        self.scroll = None
        self.character = None

        # 玩家属性 战斗中
        self.atk_temp = 0  # 临时攻击力
        self.skill_point = 0  # 技能点数

        # 怪物属性
        self.monster_name = ''
        self.monster_hp = 0
        self.monster_atk = 0

        # 游戏状态
        self.floor = 1
        self.room_idx = 1
        self.player_name = 'Player'

        # 地图数据
        self.room = ''
        self.map = {}
        self.map_text = ''

    def __str__(self, battle=False):
        """显示玩家状态"""
        return (
            f'[{self.player_name}] '
            f'HP:{self.hp} '
            f'ATK:{
                f'{self.xp_level}~{2 * self.xp_level + 4}' if self.eatk <= 0 else
                f'[{self.xp_level}~{2 * self.xp_level + 4}]+{self.eatk}'
            } '
            f'XP:{self.xp_level}级{f'+{self.xp}' if self.xp > 0 else ''} '
            f'Def:{self.defense}/{self.defense_max} '
            f'Coin:{self.coin} '
            f'Food:{self.food} '
            f'{f'SP:{self.skill_point} ' if battle else ''}'
            f'{f'卷轴[{self.scroll[0]}] ' if self.scroll else ''}'
        )

    def select_character(self):
        """角色选择"""
        while True:
            print('\n请选择一位冒险者:')

            chosen_chars = sample(CHARS, 3)
            for i, (name, hp, coin, def_max, food, eatk, skill) in enumerate(chosen_chars):
                print(f'{i + 1}. [{name}] HP{hp} Coin{coin} Def{def_max} Food{food} ATK+{eatk} 技能[{skill}]')

            try:
                choice = int(input('请选择 (1-3): ')) - 1
                self.character = selected_char = chosen_chars[choice]
                self.player_name = selected_char[0] +  self.player_name # 角色名
                self.hp, self.coin, self.defense_max, self.food, self.eatk, self.skill = selected_char[1:]
                self.defense = self.defense_max  # 初始防御等于最大防御
                print(f'你选择了冒险者: {selected_char[0]}')
                break

            except (ValueError, IndexError):
                print('无效选择，请重新输入')

        if self.skill == '卷轴':
            self.scroll = SCROLLS[randint(0, len(SCROLLS) - 1)]
            print(f'\n{self.character[0]}发动[{self.skill}]技能，获得一个卷轴[{self.scroll[0]}]！')

    def generate_map(self):
        # 生成地图字典，坐标tuple(floor:int, room:int): 房间tuple(name:str, func_name:str)
        for floor in range(1, FLOOR + 1):  # 1-4层
            for room in range(1, floor + ROOM_ADD + 1):  # 每层房间数 = 层数 + 2
                if room < floor + ROOM_ADD:
                    self.map[(floor, room)] = choices(ROOMS, weights=ROOMS_WEIGHT)[0]
                else:
                    self.map[(floor, room)] = ROOMS[-1]  # BOSS房间

        # 构建地图文本，部分保持未知
        for floor in range(1, FLOOR + 1):
            row = []
            for room_idx in range(1, floor + ROOM_ADD + 1):
                room_type = self.map.get((floor, room_idx), '空')[0]  # 获取房间类型
                if room_type != 'BOSS' and random() < 0.3:  # 概率未知房间
                    room_type = '？？'
                row.append(room_type.ljust(2))
            self.map_text += f'第{floor}层 | ' + ' | '.join(row) + '\n'

        # 神算技能，显示地图
        if self.skill == '神算':
            print(f'\n{self.character[0]}发动[{self.skill}]技能，探测部分房间！')
            print(self.map_text)

        input('按回车继续...')

    def explore(self):
        """游戏主循环"""
        from events import change_attr, enter_room

        for floor in range(1, FLOOR + 1):  # 1-4层
            self.floor = floor
            for room_idx in range(1, floor + ROOM_ADD + 1):
                # 进入房间
                self.room_idx = room_idx
                os.system('cls' if os.name == 'nt' else 'clear')
                print(f'进入: 层{floor}-房间{room_idx}')
                enter_room()
                print()

                # 检查玩家是否存活
                if self.hp <= 0:
                    print('你已死亡！游戏结束\n')
                    input('按回车继续...')
                    return

                # 检查xp升级
                if self.xp >= XP_MAX:
                    print(f'经验等级提升！余下 {self.xp % XP_MAX} 经验')
                    change_attr('xp_level', self.xp // XP_MAX)
                    self.xp %= XP_MAX

                # 防御恢复
                if self.defense < self.defense_max:
                    print('防御恢复', end=' ')
                    change_attr('defense', +1)

                # 食物消耗
                if self.food > 0:
                    print(f'消耗食物，剩余 {self.food} 份')
                    change_attr('food', -1)
                    change_attr('hp', randint(2, floor + 2))  # 吃食物加血
                else:
                    print('没有食物了，好饿！', end=' ')
                    change_attr('hp*', -randint(1, floor + 2))  # 没有食物时扣血

                # 检查玩家是否存活
                if self.hp <= 0:
                    print('你已死亡！游戏结束\n')
                    input('按回车继续...')
                    return

                input('按回车继续...')

        # 游戏通关
        print('\n恭喜你，成功通关！')
        print('你找到了传说中的鹰魂结晶💎！')
        input('按回车继续...')

if __name__ == '__main__':
    from main import entrance
    entrance()