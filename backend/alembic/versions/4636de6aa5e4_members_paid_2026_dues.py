"""members_paid_2026_dues

Revision ID: 4636de6aa5e4
Revises: 4b69eefadf7f
Create Date: 2026-09-27 00:35:56.610570

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4636de6aa5e4'
down_revision: Union[str, Sequence[str], None] = '4b69eefadf7f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """members 表加「是否已繳納 2026 年會費」欄位（預設 False）。"""
    op.add_column(
        "members",
        sa.Column(
            "paid_2026_dues",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("members", "paid_2026_dues")
