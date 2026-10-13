"""add division.name_en and candidate.bio_en

Revision ID: 0462caa244b9
Revises: 4636de6aa5e4
Create Date: 2026-10-10

新增兩個英文欄位：
  divisions.name_en   分會英文名稱（英文介面顯示用）
  candidates.bio_en   候選人英文版個人簡介

兩者都以 server_default='' 加入，加入後立刻移除 server_default，
與模型中 default="" 的寫法保持一致（與先前的 migration 相同做法）。
"""
from alembic import op
import sqlalchemy as sa

revision = "0462caa244b9"
down_revision = "4636de6aa5e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "divisions",
        sa.Column("name_en", sa.String(length=64), nullable=False, server_default=""),
    )
    op.alter_column("divisions", "name_en", server_default=None)

    op.add_column(
        "candidates",
        sa.Column("bio_en", sa.Text(), nullable=False, server_default=""),
    )
    op.alter_column("candidates", "bio_en", server_default=None)


def downgrade() -> None:
    op.drop_column("candidates", "bio_en")
    op.drop_column("divisions", "name_en")
