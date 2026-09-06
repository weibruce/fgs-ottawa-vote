"""初始化資料庫 — 建立預設管理員 + 五個分區
執行: .venv/bin/python -m app.init_db
"""
from app.database import SessionLocal, engine, Base
from app.models import Admin, Division
from app.services.auth import hash_password

# 五區預設配置
DIVISIONS = [
    {"code": "east", "name": "東區", "min_votes": 1, "max_votes": 2, "color": "#C41E24", "sort_order": 1},
    {"code": "south", "name": "南區", "min_votes": 1, "max_votes": 2, "color": "#D98E04", "sort_order": 2},
    {"code": "west", "name": "西區", "min_votes": 1, "max_votes": 2, "color": "#2E7D32", "sort_order": 3},
    {"code": "north", "name": "北區", "min_votes": 1, "max_votes": 2, "color": "#1565C0", "sort_order": 4},
    {"code": "central", "name": "中區", "min_votes": 1, "max_votes": 2, "color": "#6A1B9A", "sort_order": 5},
]

DEFAULT_ADMIN_USER = "admin"
DEFAULT_ADMIN_PASS = "admin123"  # 首次登入強制修改


def init():
    print("=== 初始化資料庫 ===")
    # 建表（若不存在）— 正常用 alembic，這裡是兜底
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # 預設管理員
        admin = db.query(Admin).filter(Admin.username == DEFAULT_ADMIN_USER).first()
        if admin is None:
            admin = Admin(
                username=DEFAULT_ADMIN_USER,
                password_hash=hash_password(DEFAULT_ADMIN_PASS),
                display_name="系統管理員",
                is_active=True,
                must_change_password=True,
            )
            db.add(admin)
            print(f"  ✓ 建立預設管理員 {DEFAULT_ADMIN_USER} / {DEFAULT_ADMIN_PASS}（首次登入強制改密）")
        else:
            print(f"  · 管理員 {DEFAULT_ADMIN_USER} 已存在")

        # 五區
        for div_data in DIVISIONS:
            div = db.query(Division).filter(Division.code == div_data["code"]).first()
            if div is None:
                db.add(Division(**div_data))
                print(f"  ✓ 建立分區 {div_data['name']} ({div_data['code']})")
            else:
                print(f"  · 分區 {div_data['name']} 已存在")

        db.commit()
        print("=== 初始化完成 ===")
        print(f"  登入: {DEFAULT_ADMIN_USER} / {DEFAULT_ADMIN_PASS}")
    finally:
        db.close()


if __name__ == "__main__":
    init()
