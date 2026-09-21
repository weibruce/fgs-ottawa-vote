"""候選人 schema（按分區 CRUD）"""
from datetime import datetime
from pydantic import BaseModel, Field


class CandidateBase(BaseModel):
    division_id: int = Field(..., description="所屬分區 ID")
    # 姓名：中文只給一邊即可，後端會自動同步繁簡；英文可只給 givenname/surname
    name: str = Field("", max_length=128, description="姓名（繁）；留空時由簡體轉出")
    name_simp: str = Field("", max_length=128, description="姓名（簡）；留空時由繁體轉出")
    givenname: str = Field("", max_length=128)
    surname: str = Field("", max_length=128)
    name_en: str = Field("", max_length=128, description="英文全名；留空時由 givenname+surname 組合")
    member_no: str = Field("", max_length=64, description="佛光會員卡號")
    gender: str = Field("", max_length=16)
    title: str = Field("", max_length=128, description="職位")
    avatar_url: str = Field("", max_length=512, description="照片")
    slogan: str = Field("", max_length=200, description="競選宣言")
    description: str = Field("", description="個人介紹")
    term_count: int = Field(0, ge=0, description="已任屆數")
    phone: str = Field("", max_length=32)
    email: str = Field("", max_length=254)
    address: str = Field("", max_length=512)
    education: str = Field("", max_length=256, description="學歷")
    occupation: str = Field("", max_length=256, description="職業")
    is_refuge: bool = Field(False, description="是否皈依")
    refuge_master: str = Field("", max_length=128, description="皈依師長")
    precept_status: str = Field("", max_length=64, description="受戒狀態")
    volunteer_group: str = Field("", max_length=128, description="義工組別")
    sort_order: int = 0
    is_active: bool = True


class CandidateCreate(CandidateBase):
    pass


class CandidateUpdate(BaseModel):
    division_id: int | None = None
    name: str | None = None
    name_simp: str | None = None
    givenname: str | None = None
    surname: str | None = None
    name_en: str | None = None
    member_no: str | None = None
    gender: str | None = None
    title: str | None = None
    avatar_url: str | None = None
    slogan: str | None = None
    description: str | None = None
    term_count: int | None = Field(None, ge=0)
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    education: str | None = None
    occupation: str | None = None
    is_refuge: bool | None = None
    refuge_master: str | None = None
    precept_status: str | None = None
    volunteer_group: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class CandidateOut(CandidateBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class CandidateAdminOut(CandidateOut):
    """管理後台列表用：附區名與（可選）當前票數"""

    division_name: str = ""
    vote_count: int | None = None
