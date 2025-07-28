import os
import sys
from state import state

def main():
    """游戏入口"""
    while True:
        choice = main_menu()
        if choice == '1':  # 开始游戏
            state.select_character()
            state.generate_map()
            state.explore()
        elif choice == '2':  # 关于游戏
            about()
        elif choice == '3':  # 退出游戏
            print('\n游戏已退出')
            sys.exit()

def main_menu():
    """显示主菜单并获取用户选择"""
    os.system('cls' if os.name == 'nt' else 'clear')  # 清屏
    while True:
        print('欢迎游玩 [FalconCrypt v6.0]\n')
        print('===== 主菜单 =====')
        print('1 [开始探索]')
        print('2 [关于]')
        print('3 [退出]')

        choice = input('请选择: ')
        if choice in ('1', '2', '3'):
            return choice

        print('无效选择，请重新输入')

def about():
    """显示关于信息"""
    info = (
        '\n关于 FalconCrypt v6.0\n'
        '概述: FalconCrypt 是一个基于文本的冒险游戏，孤身深入鹰穴，探寻神秘的鹰魂结晶...\n'
        '符号说明: ❤️HP=生命值，🪙Coin=金币，🛡️Def=防御，🥖Food=食物，🗡️ATK=攻击，🧠XP=经验值，⚙️SP=技能点\n'
        '游戏目标: 探索地图，收集资源，加强角色，击败所有BOSS\n'
        '环境: Windows 11，Python 3.13，终端字体 Cascadia Mono\n'
        '作者: Infinovast @Github'
    )
    print(info)
    input('\n按回车返回主菜单...')

def entrance():
    """运行入口"""
    main()

if __name__ == '__main__':
    entrance()