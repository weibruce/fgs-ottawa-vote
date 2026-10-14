"""add divisions.include_in_vote

Revision ID: f6dc3acae06a
Revises: 0462caa244b9
Create Date: 2026-10-14

新增 divisions.include_in_vote（預設 true）。
設為 false 的分會完全不參與投票：
- 投票端的選舉資訊 / 分區清單 / 結果 / 大屏都不會出現
- 該分會的會員在身份驗證時會被明確擋下（而不是看到空白的候選人清單）
- 後台仍可正常管理該分會的會員與資料
"""
from alembic import op
import sqlalchemy as sa

revision = "f6dc3acae06a"
down_revision = "0462caa244b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "divisions",
        sa.Column("include_in_vote", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.alter_column("divisions", "include_in_vote", server_default=None)


def downgrade() -> None:
    op.drop_column("divisions", "include_in_vote")
