from fastapi import APIRouter, Depends, HTTPException, status
from ..schemas import auth as schema
from ..core import security
from .deps import get_db, get_current_user

router = APIRouter()

@router.post("/signup", response_model=schema.Token)
async def signup(user_in: schema.UserCreate, db = Depends(get_db)):
    try:
        user = await db.users.find_one({"email": user_in.email})
        if user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        hashed_password = security.get_password_hash(user_in.password)
        new_user = {
            "email": user_in.email,
            "hashed_password": hashed_password,
            "github_token_encrypted": None
        }
        await db.users.insert_one(new_user)
        
        access_token = security.create_access_token(subject=user_in.email)
        return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/login", response_model=schema.Token)
async def login(user_in: schema.UserLogin, db = Depends(get_db)):
    try:
        user = await db.users.find_one({"email": user_in.email})
        if not user:
            raise HTTPException(status_code=400, detail="Incorrect email or password")
            
        if not security.verify_password(user_in.password, user["hashed_password"]):
            raise HTTPException(status_code=400, detail="Incorrect email or password")
        
        access_token = security.create_access_token(subject=user["email"])
        return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/github-token")
async def update_github_token(
    token_in: schema.GitHubTokenUpdate, 
    current_user = Depends(get_current_user), 
    db = Depends(get_db)
):
    """
    Securely encrypts and stores the user's GitHub Token.
    """
    encrypted = security.encrypt_token(token_in.token)
    await db.users.update_one(
        {"email": current_user["email"]},
        {"$set": {"github_token_encrypted": encrypted}}
    )
    return {"msg": "GitHub token updated securely"}

@router.get("/me")
async def read_users_me(current_user = Depends(get_current_user)):
    return {
        "email": current_user["email"], 
        "has_github_token": current_user.get("github_token_encrypted") is not None
    }
