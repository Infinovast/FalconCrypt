from random import choice, choices, randint, random, sample
from consts import *
from state import state

def change_attr(attr:str, diff:None or tuple):
    """修改玩家属性并打印变化"""
    if diff == 0:
        return

    if attr == 'scroll':
        if diff is None:
            print(f'失去{ATTRS['scroll']} [{state.scroll[0]}]')
            state.scroll = None
            return
        if state.scroll:
            print(f'替换原有卷轴 [{state.scroll[0]}]{state.scroll[1]}')
        state.scroll = diff
        print(f'获得{ATTRS['scroll']} [{diff[0]}]{diff[1]}')
        return

    if attr == 'hp' and diff < 0 < state.defense:
        # 如果是伤害，且有护甲，则计算护甲吸收
        if -diff <= state.defense:
            print(f'你的护甲吸收了所有伤害 {ATTRS['defense']}{diff} ({state.defense + diff})')
            state.defense += diff  # 护甲吸收伤害
        else:
            print(f'你的护甲破碎了 {ATTRS['defense']}{-state.defense} (0)')
            damage_overflow = (diff + state.defense - 1) // 2  # 护甲破碎，伤害溢出，除2向上取整
            print(f'伤害部分溢出 {ATTRS['hp']}{damage_overflow} ({state.hp + damage_overflow})')
            state.hp = max(0, state.hp + damage_overflow)  # 护甲破碎，伤害溢出
            state.defense = 0  # 护甲被破坏，防御归零
        return

    if attr == 'hp*':
        attr = 'hp'  # 真伤，直接修改hp
        if diff < 0:
            print(f'护甲无法抵挡这种伤害', end=' ')

    # 下面是普通属性变化
    setattr(state, attr, max(0, getattr(state, attr) + diff))  # 防止负数属性
    print(f'{ATTRS[attr]}{diff:+d} ({getattr(state, attr)})')

def enter_room(room: tuple = None):
    """启动一个房间"""
    # 如果没有指定房间，则根据当前楼层和房间索引获取
    if room is None:
        room = state.map[(state.floor, state.room_idx)]
    print(f'[{room[0]}房间]')
    print(state)

    # 调用room这个房间的事件函数
    globals()[room[1]]()

def monster_event(monster_name = None, monster_hp = None, monster_atk = None):
    """处理怪物遭遇事件"""
    # 根据楼层确定怪物强度
    base_hp = state.floor * 4 + randint(2, 5)
    base_atk = state.floor + randint(1, 2)

    # 随机怪物类型
    monster_types = [
        ('蜘蛛', base_hp, base_atk),
        ('毒鼠', base_hp - 2, base_atk + 4),
        ('骷髅', base_hp + 2, base_atk),
        ('灵卫', base_hp + 2, base_atk + 2),
        ('狼人', base_hp + 3, base_atk + 1),
        ('巨魔', base_hp + 4, base_atk),
        ('虫群', base_hp + 7, base_atk - 1)
    ]
    name, hp, atk = choice(monster_types)
    name = monster_name or name
    hp = monster_hp if monster_hp is not None else hp
    atk = monster_atk if monster_atk is not None else atk

    battle(name, hp, atk)

def boss_event():
    """处理BOSS遭遇事件"""
    # 根据楼层选择BOSS
    bosses = [
        ('巨型蜘蛛', 15, 4),
        ('蟒', 25, 6),
        ('重甲骷髅', 35, 5),
        ('地狱犬', 38, 8)
    ]
    name, hp, atk = bosses[state.floor - 1]

    if state.floor >= 2:
        hp = max(
            bosses[state.floor - 1][1],
            int(1.5 * state.xp_level + 2 + state.eatk) * 4 + randint(-2, 3)
        )  # BOSS血量取玩家ATK*4
        atk = min(
            bosses[state.floor - 1][2],
            (state.hp + state.defense) // 4 + randint(0, 2)
        )  # BOSS攻击力取玩家(HP+Def)/4

    battle(name, hp, atk)

def battle(monster_name: str, monster_hp: int, monster_atk: int, source: str = '怪物'):
    """战斗和奖励"""
    print(f'\n遭遇{monster_name}，准备战斗！')
    state.monster_name, state.monster_hp, state.monster_atk = monster_name, monster_hp, monster_atk
    state.atk_temp = 0  # 重置临时攻击力
    state.skill_point = SKILL_POINT_MAX  # 重置技能点数

    while state.hp > 0 and state.monster_hp > 0:
        # 显示双方状态（怪物ATK可能浮动）
        print(state.__str__(battle=state.skill in ['挑衅', '血祭', '净化']))
        print(f'[{state.monster_name}] HP:{state.monster_hp} '
              f'ATK:{f'{state.monster_atk}' if state.monster_atk < 4 else 
                  f'{state.monster_atk - 1}~{state.monster_atk + 1}'} ')

        # 玩家回合
        player_turn()

        # 检查玩家存活
        if state.hp <= 0:
            print('太不小心了!')
            return

        # 检查怪物存活
        if state.monster_hp <= 0:
            print('怪物已被击败!\n')
            # 重置临时攻击力
            if state.atk_temp != 0:
                print(f'临时攻击力失效', end=' ')
                change_attr('eatk', -state.atk_temp)
                state.atk_temp = 0

            # 胜利奖励
            print('[战利品]', end=' ')
            change_attr('coin', state.floor + randint(1,  4 if source != 'BOSS' else 7))  # 根据来源调整金币奖励
            print('[战斗经验]', end=' ')
            change_attr('xp', state.floor + monster_atk // 3 + monster_hp // 9)  # 用原怪物属性计算经验
            if source == 'BOSS' or random() < 0.3:
                chest_event()  # 掉宝箱
            return

        # 处理激活的卷轴
        if state.scroll == '激活寒冰术':  # 如果被冻结，跳过怪物行动
            print('怪物被冻结，无法行动！\n')
            state.scroll = None
            continue
        elif state.scroll == '激活隐身术':  # 如果隐身，逃离战斗
            print('你使用隐身术逃离了战斗！')
            state.scroll = None
            return

        # 怪物回合
        print(f'怪物对你发动攻击', end=' ')
        change_attr('hp', -state.monster_atk if state.monster_atk < 4 else -state.monster_atk + randint(-1, 1))  # 怪物攻击伤害

        # 检查玩家存活
        if state.hp <= 0:
            print('你已被怪物击败!')
            return

        print('\n战斗继续...')

def player_turn():
    """玩家回合"""
    SKILLS = {
        '挑衅': ('ATK Temp+ -> Monster:ATK+', 6, True),
        '血祭': ('ATK Temp+ -> HP-', 4, True),
        '净化': ('Monster:ATK- -> Food-1', 6, state.food > 0 and state.monster_atk > 2),
    }
    '''技能列表 (技能名: (描述, 技能点消耗, 可用条件))'''

    def use_skill():
        """使用技能"""
        change_attr('skill_point', -SKILLS[state.skill][1])  # 扣除技能点
        if state.skill == '挑衅':
            num1 = randint(1, 3)
            num2 = randint(1, 3)
            print('你使用了[挑衅]技能， 双方攻击力临时增加！')
            print(f'ATK Temp+{num1} -> Monster:ATK+{num2}')
            state.atk_temp += num1
            change_attr('eatk', num1)
            change_attr('monster_atk', num2)
        elif state.skill == '血祭':
            n = randint(2, 4)
            print('你使用了[血祭]技能，牺牲HP获得临时攻击力！')
            print(f'ATK Temp+{n - 1} -> HP-{n}')
            state.atk_temp += n - 1
            change_attr('hp*', -n)
            change_attr('eatk', n - 1)
        elif state.skill == '净化':
            n = randint(1, 2)
            print('你使用了[净化]技能，消耗食物来降低怪物攻击力！')
            print(f'Monster:ATK-{n} -> Food-1')
            change_attr('food', -1)
            change_attr('monster_atk', -n)
        else:
            print('无效技能')

    def use_scroll():
        """使用卷轴"""
        scroll_name, description = state.scroll
        if scroll_name == '火球术':
            state.scroll = None
            damage_add = randint(9, 14)
            print(f'火球术造成 {damage_add} 点额外伤害!')
            return base_atk + state.eatk + damage_add
        elif scroll_name == '寒冰术':
            state.scroll = '激活寒冰术'  # 激活冻结状态
            print('寒冰术冻结怪物一回合!')
        elif scroll_name == '治疗术':
            state.scroll = None
            heal_amount = randint(9, 13)
            if state.hp >= 6:
                print('伤势不重，疗效降低')
                heal_amount = randint(4, 7)
            change_attr('hp', heal_amount)
        elif scroll_name == '隐身术' and state.map[(state.floor, state.room_idx)] != ROOMS[-1]:
            state.scroll = '激活隐身术'  # 激活隐身状态
            print('激活隐身术，现在逃离这里!')
        return None

    options = ['普通攻击']
    print('\n你的回合:')
    if state.skill in SKILLS and state.skill_point >= SKILLS[state.skill][1] and SKILLS[state.skill][2]:
        options.append('使用技能')
    if state.scroll:
        options.append('使用卷轴')

    for i, option in enumerate(options):
        print(f'{i + 1}. {option}', end=' ')
        if option == '使用技能':
            print(f'[{state.skill}] {SKILLS[state.skill][0]}, SP-{SKILLS[state.skill][1]}')
        elif option == '使用卷轴':
            print(f'[{state.scroll[0]}] {state.scroll[1]}')
        else:
            print()

    base_atk = randint(state.xp_level, 2 * state.xp_level + 4)  # 基础攻击力取在范围内

    while True:
        try:
            option = options[int(input('请选择行动: ')) - 1]
            if option == '使用技能':
                use_skill()
                break
            elif option == '使用卷轴':
                damage = use_scroll()
                if damage is not None:
                    state.monster_hp -= damage
                    print(f'你对怪物造成 {damage} 点伤害!')
                    return
                break
            elif option == '普通攻击':
                break
        except (ValueError, IndexError):
            print('输入无效，请重新输入。')

    player_damage = base_atk + state.eatk
    state.monster_hp -= player_damage  # 普通攻击伤害
    print(f'你对怪物造成 {player_damage} 点伤害!')

def chest_event():
    """宝箱事件"""
    print('\n发现一个宝箱！')

    # 随机奖励数量 (0-3项)
    reward_count = choices(
        [0, 1, 2, 3, 4],
        weights=[1, 4, 3, 2, 1]  # 1项奖励概率最高
    )[0]

    if reward_count == 0:
        print('宝箱是空的...')
        return

    print(f'宝箱中有 {reward_count} 项奖励!')

    # 可能的奖励类型
    possible_rewards = [
        ('金币', lambda: change_attr('coin', randint(2, 8))),
        ('浑浊的药水', lambda: change_attr('hp*', randint(-2, 4) or +1)),  # -2到2之间的随机数，0时改为+1
        ('生命药水', lambda: change_attr('hp', +6)),
        ('磨刀石', lambda: change_attr('eatk', +1)),
        ('劣质护甲板', lambda: change_attr('defense', +4)),
        ('优质护甲', lambda: change_attr('defense_max', +1)),
        ('卷轴', lambda: change_attr('scroll', SCROLLS[randint(0, len(SCROLLS) - 1)]))
    ]
    weights = [3, 2, 2, 1, 3, 1, 1]  # 奖励权重

    # 获取随机奖励
    for i in range(reward_count):
        reward = choices(
            possible_rewards,
            weights=weights
        )[0]
        weights[possible_rewards.index(reward)] = 0  # 防止下次重复奖励

        print(f'[{reward[0]}]', end=' ')
        reward[1]()  # 执行奖励

def trap_event():
    """陷阱事件"""
    print('\n你触发了一个陷阱！')
    # 随机陷阱类型
    trap_types = [
        ('火焰', '穿透护甲灼伤皮肤', lambda: change_attr('hp*', -randint(2, state.floor + 1))),
        ('酸雾', '对人无害，只腐蚀护甲', lambda: change_attr('defense', -state.defense)),
        ('落石', '被砸到很痛', lambda: change_attr('hp', -randint(2, state.floor + 2))),
        ('尖刺', '被扎到特别痛', lambda: change_attr('hp', -randint(4, 7)))
    ]
    trap = choice(trap_types)
    print(f'这是{trap[0]}陷阱，{trap[1]}。')
    trap[2]()  # 执行陷阱效果

    # 陷阱可能掉落物品
    if random() < 0.5:  # 50%概率掉落物品
        item = choice([
            ('遗失的秘籍', lambda: change_attr('xp', randint(1, 4))),
            ('散落的金币', lambda: change_attr('coin', randint(3, 7)))
        ])
        print(f'你捡到了: [{item[0]}]')
        item[1]()  # 执行物品效果

def shop_event():
    """商人事件"""
    print('\n你遇到了一个商人！')
    print('商人提供各种物品供你购买。')

    # 商人提供的物品 (名称, 描述, 价格[负数表示购买], 效果函数)
    items = [
        ('小生命药水', 'HP+5', -3, lambda: change_attr('hp', +5)),
        ('大生命药水', 'HP+9', -5, lambda: change_attr('hp', +9)),
        ('磨刀石', 'ATK Extra+1', -4, lambda: change_attr('eatk', +1)),
        ('劣质护甲板', 'Def+3~6', -4, lambda: change_attr('defense', randint(3, 6))),
        ('护甲片', 'Def Max+1', -6, lambda: change_attr('defense_max', +1)),
        ('金币袋', 'Coin+1~5', -3, lambda: change_attr('coin', randint(1, 5))),
        ('小份干粮', 'Food+2', -3, lambda: change_attr('food', +2)),
        ('大份干粮', 'Food+5', -6, lambda: change_attr('food', +5)),
        ('卷轴', 'Scroll+', -6, lambda: change_attr('scroll', SCROLLS[randint(0, len(SCROLLS) - 1)])),
        ('出售护甲片', 'Def Max-1', +5, lambda: change_attr('defense_max', -1)),
        ('出售食物', 'Food-1', +1, lambda: change_attr('food', -1)),
        ('出售卷轴', 'Scroll-', +5, lambda: change_attr('scroll', None))
    ]
    # 随机选择6-9个物品，保持原有顺序
    indices = sorted(sample(range(len(items)), randint(6, 9)))
    selected_items = [items[i] for i in indices]

    # 显示商人物品
    for i, (name, description, price, _) in enumerate(selected_items):
        print(f'{i + 1}. [{name + ' ' + description}] -> {price:+} Coin')

    while True:
        num = input('请选择物品编号 (或输入0退出): ')
        if num == '0':
            print('离开商人')
            return

        try:
            index = int(num) - 1
            if index < 0 or index >= len(selected_items):
                raise ValueError('无效选择')

            name, description, price, effect = selected_items[index]
            if state.coin < -price and price < 0:
                print('金币不足，无法购买')
            elif name == '卷轴' and state.scroll:
                print('已经拥有卷轴，无法重复购买')
            elif name == '出售护甲片' and state.defense_max <= 0:
                print('没有护甲片可出售')
            elif name == '出售食物' and state.food <= 0:
                print('没有食物可出售')
            elif name == '出售卷轴' and not state.scroll:
                print('没有卷轴可出售')
            else:
                print(f'[{name}]', end=' ')
                effect()  # 执行物品效果
                change_attr('coin', price)  # 扣除或增加金币

        except ValueError as e:
            print(f'错误: {e}, 请重新输入')

def bonfire_event():
    """篝火事件"""
    print('\n你发现了一个篝火！')
    print('在这里你可以休息、加工食物，也可以四处转转。')

    def search():
        """篝火事件的搜索功能"""
        # 随机触发1-3个分支（食物、金币、怪物），每个分支最多触发一次
        branches = [
            lambda: (print('你找到了一些食物！', end=' '), change_attr('food', randint(4, 7))),
            lambda: (print('你找到了一些金币！', end=' '), change_attr('coin', randint(3, 9))),
            lambda: monster_event(monster_hp=randint(8, 12), monster_atk=randint(1, 4))
        ]
        selected = sample(branches, randint(1, 3))
        for branch in selected:
            branch()

    actions = [
        ('治疗', 'HP+', lambda: change_attr('hp', randint(2, 6))),
        ('加工食物', 'Food+', lambda: change_attr('food', randint(1, 4))),
        ('打磨武器', 'ATK Extra+/-', lambda: change_attr('eatk', randint(-1, 2) or +1)),
        ('搜索', 'Food++/Coin+/Monster', lambda: search())
    ]

    for i, (name, description, _) in enumerate(actions):
        print(f'{i + 1}. [{name} {description}]')

    while True:
        num = input('请选择 (或输入0退出): ')
        if num == '0':
            print('离开篝火')
            return

        try:
            index = int(num) - 1
            if index < 0 or index >= len(actions):
                raise ValueError('无效选择')

            name, description, effect = actions[index]
            print(f'执行: {name}')
            effect()  # 执行物品效果
            return

        except ValueError as e:
            print(f'错误: {e}, 请重新输入')

def forge_event():
    """铸锻间事件"""
    print('\n你进入了铸锻间！')
    print('在这里你可以升级装备或制作新物品。')

    def forge_armor():
        """锻造护甲"""
        if state.defense_max < 7:
            print('你的护甲升级了！')
            change_attr('defense_max', +1)
        else:
            print('这里没有更好的护甲了！')

    actions = [
        ('升级武器', 'ATK Extra+/-', 4, lambda: change_attr('eatk', randint(-1, 2) or +1)),
        ('锻造护甲', 'Def Max+1', 5, forge_armor)
    ]

    for i, (name, description, price, _) in enumerate(actions):
        print(f'{i + 1}. [{name} {description}] -> {price} Coin')

    while True:
        num = input('请选择 (或输入0退出): ')
        if num == '0':
            print('离开铸锻间')
            return

        try:
            index = int(num) - 1
            if index < 0 or index >= len(actions):
                raise ValueError('无效选择')

            name, description, price, effect = actions[index]
            if state.coin < price:
                print('金币不足，无法升级')
                continue

            state.coin -= price
            print(f'执行: {name}')
            effect()  # 执行物品效果
            return

        except ValueError as e:
            print(f'错误: {e}, 请重新输入')

def statue_event():
    """雕像事件"""
    print('\n你发现了一尊神秘的雕像！')
    print('你可以向雕像祈祷或供奉，获得祝福或诅咒。')

    print('1. [祈祷] 获得祝福或诅咒\n2. [供奉] 获得祝福的概率翻倍 -> Coin-/Food-')
    num = input('祈祷、供奉或是离开？(输入1祈祷/2供奉，否则离开): ')
    if num not in ('1', '2'):
        print('离开雕像')
        return

    if num == '2':
        if  state.coin > 0:
            print('虔诚地献上金币', end=' ')
            change_attr('coin', -min(state.coin, randint(3, 5)))
        elif state.food > 0:
            print('虔诚地献上食物', end=' ')
            change_attr('food', -min(state.coin, 1))
        else:
            print('没有足够的食物或金币，无法供奉')
            num = '1'  # 如果供奉失败，改为祈祷
    print('你向雕像祈祷...')

    if random() < (0.9 if num == '2' else 0.4):
        print('[先祖赐福]', end=' ')
        selected = choices(
            [
                ('hp', randint(2, 5)),
                ('defense', randint(2, 6)),
                ('eatk', 1),
                ('xp', randint(0, 3) or XP_MAX)
            ],
            weights=[2, 2, 1, 1]
        )[0]
        change_attr(selected[0], selected[1])
    else:
        print('[异端的诅咒]', end=' ')
        selected = choice([('hp*', -randint(2, 5)), ('xp', -1)])
        change_attr(selected[0], selected[1])

def mine_event():
    """矿洞事件"""
    print('\n你发现了一个废弃矿洞入口！')
    print('你可以消耗食物，深入矿洞挖掘宝藏、寻找矿石。')

    def mine():
        """挖掘动作"""
        if state.food <= 0:
            print('没有足够的食物，无法深入矿洞')
            return
        change_attr('food', -1)
        flag = random()
        if flag < 0.2:
            print('你挖到了埋藏的宝藏！')
            chest_event()
        elif flag < 0.3:
            print('你挖到了一些罕见的矿石！')
            selected = choice([('eatk', 1), ('defense_max', 2)])
            change_attr(selected[0], selected[1])
        elif flag < 0.6:
            print('你挖到了一些普通矿石。')
            change_attr('coin', randint(3, 8))
        elif flag < 0.8:
            print('你采摘到一些矿洞植物。')
            change_attr('food', randint(1, 3))
            change_attr('hp', randint(2, 5))
        elif flag < 0.9:
            print('你遇到了一只幼年矿洞巨兽！')
            monster_event('幼年岩虫', randint(5, 10), randint(1, 3))
        else:
            print('只挖到一些废石，没有收获。')

    print('1. [挖掘宝藏', 'Coin/eATK+] -> Food-1')
    num = input('是否进入矿洞？(输入1以确定，否则退出): ')
    if num != '1':
        print('离开矿洞')
        return
    mine()

if __name__ == '__main__':
    from main import entrance
    entrance()
