"""Add the sidebar_tutorial_dismissed column to user table.

Revision ID: 1ef80156ee4
Revises: 43645baa68b2
Create Date: 2015-12-21 18:49:15.688177

"""

# revision identifiers, used by Alembic.
revision = '1ef80156ee4'
down_revision = '43645baa68b2'

from alembic import op
import sqlalchemy as sa


def upgrade():
    with op.batch_alter_table('user') as batch_op:
        batch_op.add_column(sa.Column('sidebar_tutorial_dismissed',
                                      sa.Boolean,
                                      nullable=False,
                                      default=False,
                                      server_default=sa.sql.expression.true()))


def downgrade():
    with op.batch_alter_table('user') as batch_op:
        batch_op.drop_column('sidebar_tutorial_dismissed')
