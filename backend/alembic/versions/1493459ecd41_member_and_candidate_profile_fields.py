"""member and candidate profile fields

新增會員與候選人的個人資料欄位（姓名英文拆分、性別、聯絡方式、學經歷、皈依受戒、義工組別…）

Revision ID: 1493459ecd41
Revises: 17206b55c422
"""
from alembic import op
import sqlalchemy as sa

revision = "1493459ecd41"
down_revision = "17206b55c422"
branch_labels = None
depends_on = None

# (表, 欄位, 型別, server_default)
STR_COLS = [
    ("members", "givenname", sa.String(128), ""),
    ("members", "surname", sa.String(128), ""),
    ("members", "gender", sa.String(16), ""),
    ("members", "email", sa.String(254), ""),
    ("members", "address", sa.String(512), ""),
    ("candidates", "member_no", sa.String(64), ""),
    ("candidates", "name_simp", sa.String(128), ""),
    ("candidates", "givenname", sa.String(128), ""),
    ("candidates", "surname", sa.String(128), ""),
    ("candidates", "gender", sa.String(16), ""),
    ("candidates", "phone", sa.String(32), ""),
    ("candidates", "email", sa.String(254), ""),
    ("candidates", "address", sa.String(512), ""),
    ("candidates", "education", sa.String(256), ""),
    ("candidates", "occupation", sa.String(256), ""),
    ("candidates", "refuge_master", sa.String(128), ""),
    ("candidates", "precept_status", sa.String(64), ""),
    ("candidates", "volunteer_group", sa.String(128), ""),
]


def upgrade() -> None:
    # 既有資料列需要 server_default 才能加 NOT NULL 欄位，加完再移除 default
    for table, name, type_, default in STR_COLS:
        op.add_column(table, sa.Column(name, type_, nullable=False, server_default=default))
        op.alter_column(table, name, server_default=None)

    op.add_column(
        "candidates",
        sa.Column("is_refuge", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column("candidates", "is_refuge", server_default=None)

    op.create_index("ix_candidates_member_no", "candidates", ["member_no"])


def downgrade() -> None:
    op.drop_index("ix_candidates_member_no", table_name="candidates")
    for table, name, _type, _default in reversed(STR_COLS):
        op.drop_column(table, name)
    op.drop_column("candidates", "is_refuge")
