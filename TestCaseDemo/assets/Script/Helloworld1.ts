import { AnswerResult } from "../../mb_courseware/coursewareCom/UICourseware";
import { UICourseware, ConfigHelper, ParseDataType, msgEventReport, PolygonNode, SpineAttachedNode } from "../../mb_courseware/cw";
import { LayerType, MusicEvent, RESOURCES, fw } from "../../mb_framework/fw";

const { ccclass, property } = cc._decorator;
const AB_COMMON = "mb_common_res";

//吸附区动效状态
enum AdsorptionAnimStatus {
    CORRECT = "correct",
    ERROR = "error",
    IDLE = "idle",
    IN = "in",
    END = "end",
    HINT = "hint"
}

//拖拽物动效状态
enum DragAnimStatus {
    CORRECT = "correct",
    ERROR = "error",
    IDLE = "idle",
    IN = "in",
    END = "end",
    PICK = "pick",
    STICK = "stick"
}


interface AdsorptionObject {
    targetIndex: number,            //吸附区对应的拖拽物ID
    currentIndex: number            //当前吸附区上面的拖拽物ID
}

@ccclass
export default class DragMatchUI extends UICourseware {

    @property(cc.Sprite)
    bg: cc.Sprite = null;

    @property(cc.Node)
    HeadArea: cc.Node = null;

    @property(cc.Node)
    DragArea: cc.Node = null;

    @property(cc.Node)
    TargetArea: cc.Node = null;

    @property(cc.Node)
    animCloneNode: cc.Node = null;
    @property(cc.Node)
    submitBtnNode: cc.Node = null;

    @property(cc.Node)
    succeedAnima: cc.Node = null;

    @property(cc.Node)
    UINode: cc.Node = null;

    ani: sp.Skeleton = null;
    ani2: sp.Skeleton = null;

    private titleSound: string = "";

    isTouched = false;

    curQuestionIndex: number = 0; // 当前题目索引
    audioTipNodeList = []; // 音频提示列表
    answeredList = []; // 已做答列表

    //*******************************自定义数据 start*/
    curDragNode: cc.Node = null;                    // 当前拖拽的节点
    dragAnimaCount: number = 0;                     //拖拽动效数量
    adsorptionAnimCount: number = 0;                //吸附区动画数量

    adsorptionNodeList: any[] = [];                 //吸附区动画列表 
    adsorptionDataList: AdsorptionObject[] = [];    //吸附区动效列表
    curDragIndex: number = 0;                       //当前拖拽索引
    dragAnimaList: any[] = [];                      //拖拽物列表
    dragedIndexList = [];                           //已做答列表
    //*******************************自定义数据 end*/

    onLoad() {
        super.onLoad();

        const manager = cc.director.getCollisionManager();
        manager.enabled = true;
        // manager.enabledDebugDraw = true;
        // manager.enabledDrawBoundingBox = true;

        this.node.on(cc.Node.EventType.TOUCH_START, this.onMouseDown, this);
        this.node.on(cc.Node.EventType.TOUCH_MOVE, this.onMouseMove, this);
        this.node.on(cc.Node.EventType.TOUCH_END, this.onMouseUp, this);
        this.node.on(cc.Node.EventType.TOUCH_CANCEL, this.onMouseUp, this);
        this.succeedAnima.zIndex = 200;
    }

    start() {
        super.start();
    }

    async onInit(data?: any) {
        this.layerName = LayerType.NORMAL;
        this.viewName = "DragMatchUI";
        super.onInit();
    }

    async _initComData() {
        await super._initComData();
        this.parseData = {};
        console.log(this.curData, "==curData");

        this.resetPage();

        ConfigHelper.pretreatmentData('title', '', ParseDataType.string, this.curData, this.parseData);//题干文字
        ConfigHelper.pretreatmentData('horn_pos', cc.v2(-470, 13), ParseDataType.pos, this.curData, this.parseData);//喇叭位置
        ConfigHelper.pretreatmentData('page_bg', '', ParseDataType.string, this.curData, this.parseData);//背景图
        ConfigHelper.pretreatmentData('title_sound', '', ParseDataType.string, this.curData, this.parseData);
        ConfigHelper.pretreatmentData('auto_play_title', 0, ParseDataType.int, this.curData, this.parseData);
        ConfigHelper.pretreatmentData('success_ani', '', ParseDataType.string, this.curData, this.parseData);
        ConfigHelper.pretreatmentData('success_sound', '', ParseDataType.string, this.curData, this.parseData);

        this.dragAnimaCount = ConfigHelper.getKeyCount("drag_animation_", 1, this.curData);
        for (let i = 1; i <= this.dragAnimaCount; i++) {
            ConfigHelper.pretreatmentData(`drag_animation_${i}`, '', ParseDataType.string, this.curData, this.parseData);
            ConfigHelper.pretreatmentData(`drag_position_${i}`, cc.Vec2.ZERO, ParseDataType.pos, this.curData, this.parseData);
        }

        this.adsorptionAnimCount = ConfigHelper.getKeyCount('adsorption_animation_', 1, this.curData);
        for (let j = 1; j <= this.adsorptionAnimCount; j++) {
            ConfigHelper.pretreatmentData(`adsorption_animation_${j}`, '', ParseDataType.string, this.curData, this.parseData);
            ConfigHelper.pretreatmentData(`adsorption_pos_${j}`, cc.Vec2.ZERO, ParseDataType.pos, this.curData, this.parseData);
        }
    }

    async startCom() {
        //开启交互
        super.startCom();
    }

    async _initComUI() {
        super._initComUI();
        if (!this.curData) return;
        this.UINode.destroyAllChildren();

        this.updateUIByRemoteData();

        const promiseList = [];
        if (this.parseData.page_bg) {
            promiseList.push(
                this.loadSpriteFrameSync(RESOURCES, this.parseData.page_bg).then((sp: cc.SpriteFrame) => {
                    this.bg.spriteFrame = sp;
                })
            );
        }

        if (this.parseData.success_ani) {
            promiseList.push(
                this.loadSkeletonData(RESOURCES, this.parseData.success_ani, (sk: sp.SkeletonData) => {
                    this.succeedAnima.getComponent(sp.Skeleton).skeletonData = sk;
                })
            );
        }

        // 初始化拖拽物列表
        for (let i = 1; i < this.dragAnimaCount + 1; i++) {
            let animName = this.parseData['drag_animation_' + i];
            promiseList.push(
                this.loadSkeletonData(RESOURCES, animName, (sk: sp.SkeletonData) => {
                    let animNode: cc.Node = cc.instantiate(this.animCloneNode);
                    animNode.active = true;
                    let skeleton = animNode.getComponent(sp.Skeleton);
                    skeleton.skeletonData = sk;
                    animNode.parent = this.UINode;
                    skeleton.setAnimation(0, 'idle', false)

                    let poly_ani = animNode.addComponent(cc.PolygonCollider);
                    let slot = skeleton.findSlot('kuang_1');
                    let collider = SpineAttachedNode.generatePolygonCollider(slot.attachment.vertices);
                    poly_ani.points = collider.points;
                    poly_ani.offset = cc.v2(slot.bone.x, slot.bone.y);

                    // 动画初始位置
                    let aniOriginalPos = this.parseData['drag_position_' + i];
                    let animEndPos = aniOriginalPos;
                    let curDragNodeIndex = i;

                    this.dragAnimaList.push({ animNode, aniOriginalPos, animEndPos, curDragNodeIndex });

                    this.updateAnimaStatus(skeleton, 0, DragAnimStatus.IN, false, DragAnimStatus.IDLE);

                })
            );
        }

        // 初始化吸附区列表
        for (let j = 1; j < this.adsorptionAnimCount + 1; j++) {
            let animName = this.parseData['adsorption_animation_' + j];
            let adsorptionPos = this.parseData['adsorption_pos_' + j];

            console.log("wztest adsorptionPos111 ", adsorptionPos);
            promiseList.push(
                this.loadSkeletonData(RESOURCES, animName, (sk: sp.SkeletonData) => {
                    let cloneAnimNode = cc.instantiate(this.animCloneNode);
                    cloneAnimNode.getComponent(sp.Skeleton).skeletonData = sk;
                    cloneAnimNode.getComponent(sp.Skeleton).setAnimation(0, 'idle', false)
                    cloneAnimNode.parent = this.UINode;
                    cloneAnimNode.active = true

                    let skeleton = cloneAnimNode.getComponent(sp.Skeleton);
                    let poly_ani = cloneAnimNode.addComponent(cc.PolygonCollider);
                    let slot = skeleton.findSlot('kuang_1');
                    let collider = SpineAttachedNode.generatePolygonCollider(slot.attachment.vertices);
                    poly_ani.points = collider.points;
                    poly_ani.offset = cc.v2(slot.bone.x, slot.bone.y);
                    cloneAnimNode.position = new cc.Vec3(adsorptionPos.x, adsorptionPos.y, 0);

                    let adsorptionData: AdsorptionObject = {
                        targetIndex: j,
                        currentIndex: 0
                    }

                    this.adsorptionNodeList.push({ adsorptionAnim: cloneAnimNode,  curAnimNodePos: cloneAnimNode.position,curAnimNode: null });

                    this.adsorptionDataList.push(adsorptionData);

                    this.submitBtnNode.active = this.checkIsShowSubmitBtn();
                    this.updateAnimaStatus(skeleton, 0, AdsorptionAnimStatus.IN, false, AdsorptionAnimStatus.IDLE);
                })
            )
        }

        return new Promise((resolve, reject) => {
            Promise.all(promiseList).then(() => {
                fw.log.info(`${this.viewName} ui init finish`);
                resolve(null);
            }).catch((error: Error) => {
                fw.log.info(`${this.viewName} ui init error ${error.message}`);
                resolve(null)
            })
        });
    }

    // 替换远程资源
    updateUIByRemoteData() {
        if (!this.curData) return;

        this.stopAllEffect();
        if (ConfigHelper.isUsable("title", this.curData)) {
            this.HeadArea.active = true;
            this.HeadArea.getChildByName("title").getComponent(cc.Label).string = this.parseData.title;
        } else {
            this.HeadArea.active = false;
        }

        if (ConfigHelper.isUsable("title_sound", this.parseData)) {
            this.HeadArea.getChildByName("laba").active = true;
            this.bindVoiceEvent();
        } else {
            this.HeadArea.getChildByName("laba").active = false;
        }

        // 是否自动读题
        if (this.parseData.auto_play_title == "1") {
            this.autoPlayAudio();
        }
    }

    onMouseDown(event: cc.Event.EventTouch) {
        // this.selectBlock = null;
        for (let i = 0; i < this.dragAnimaList.length; i++) {
            const animNode = this.dragAnimaList[i]["animNode"];
            let animNodeCollider = animNode.getComponent(cc.PolygonCollider);
            if (cc.Intersection.pointInPolygon(event.getLocation(), animNodeCollider.world.points)) {
                console.log("选中了一个");
                this.updateAdsorptionAnimStatus(AdsorptionAnimStatus.HINT);
                this.curDragNode = animNode;

                this.isTouched = true;
                this.curDragNode.zIndex = this.curDragNode.zIndex + 100;
                this.updateAnimaStatus(this.curDragNode.getComponent(sp.Skeleton), 0, DragAnimStatus.PICK, false);
                this.curDragIndex = this.dragAnimaList[i]["curDragNodeIndex"];
                cc.log("wztest onMouseDown ", event.getLocation(), animNodeCollider.offset, animNode.position, this.curDragIndex);

            }
        }
    }

    onMouseMove(event) {
        if (this.isTouched && this.curDragNode) {
            const touchPos = event.touch._point;
            const pos = this.curDragNode.parent.convertToNodeSpaceAR(cc.v2(touchPos.x, touchPos.y));
            let collider = this.curDragNode.getComponent(cc.PolygonCollider);
            this.curDragNode.x = pos.x - collider.offset.x;
            this.curDragNode.y = pos.y - collider.offset.y;
        }
    }

    onMouseUp(event) {
        if (this.curDragNode && this.isTouched) {
            let isCollision = false;
            const touchPos = event.touch._point;
            const pos = this.curDragNode.parent.convertToNodeSpaceAR(cc.v2(touchPos.x, touchPos.y));

            for (let index = 0; index < this.adsorptionDataList.length; index++) {
                const moveToAdsorption = this.adsorptionDataList[index]

                //获取当前吸附区数据状态
                const curAdsorptionNodeParam = this.adsorptionNodeList[index]
                const adsorptionNode = curAdsorptionNodeParam["adsorptionAnim"];

                if (cc.Intersection.polygonPolygon(this.curDragNode.getComponent(cc.PolygonCollider).world.points,
                    adsorptionNode.getComponent(cc.PolygonCollider).world.points)) {
                    console.log(`两个矩形碰撞了 和第${index}个吸附区碰撞`);
                    isCollision = true;

                    let adsorptionCollider = adsorptionNode.getComponent(cc.PolygonCollider);
                    let dragCollider = this.curDragNode.getComponent(cc.PolygonCollider);

                    //碰撞吸附时的三个状态 1.吸附区没有直接吸附  
                    // 2.吸附区已经有拖拽物 2.1如果当前的拖拽物是来自拖拽区，则吸附区拖拽物回归原位，如果当前拖拽物是来自另一个吸附区，则交换
                   
                    let dargAnimaData = this.dragAnimaList[this.curDragIndex - 1];
                    
                    if (moveToAdsorption.currentIndex == 0) {
                        // 吸附区没有其他拖拽物，直接吸附
                        moveToAdsorption.currentIndex = this.curDragIndex;
                    } 
                    else {
                        // 获取当前吸附区上的拖拽物
                        //当前拖动的拖拽物数据
                        let adsorptionDragData = this.dragAnimaList[moveToAdsorption.currentIndex - 1];

                        if (dargAnimaData.aniOriginalPos == dargAnimaData.animEndPos) {
                            adsorptionDragData.animNode.x = adsorptionDragData.aniOriginalPos.x;
                            adsorptionDragData.animNode.y = adsorptionDragData.aniOriginalPos.y;
                            adsorptionDragData.animEndPos = adsorptionDragData.aniOriginalPos;
                        } else {
                            //从其他吸附区拖过来的，两个题干需要交换

                            let dragCollider = adsorptionDragData.animNode.getComponent(cc.PolygonCollider);
                            let moveFromAdsorption = this.getAdsorptionByIndex(this.curDragIndex);
                            if(moveFromAdsorption){

                                adsorptionDragData.animNode.x = moveFromAdsorption.adsorptionNode.curAnimNodePos.x  - dragCollider.offset.x;
                                adsorptionDragData.animNode.y = moveFromAdsorption.adsorptionNode.curAnimNodePos.y  - dragCollider.offset.y - 5;
    
                                moveFromAdsorption.adsorptionData.currentIndex = moveToAdsorption.currentIndex;
                                adsorptionDragData.animEndPos = adsorptionDragData.animNode.position;
                            }
                          
                        }


                        moveToAdsorption.currentIndex = this.curDragIndex;
                    }

                    this.curDragNode.x = adsorptionNode.x  - dragCollider.offset.x;
                    this.curDragNode.y = adsorptionNode.y  - dragCollider.offset.y - 5;
                    dargAnimaData.animEndPos = this.curDragNode.position;

                }


            }

            if (!isCollision) {
                //没有到吸附区范围，拖拽物回到起始点
                let adsorptionDragData = this.dragAnimaList[this.curDragIndex - 1];
                let data = this.getAdsorptionByIndex(this.curDragIndex);
                if(data){
                    data.adsorptionData.currentIndex = 0;
                }
                this.curDragNode.position = adsorptionDragData.aniOriginalPos;
                //未吸附，拖拽物播放ilde
                this.updateAnimaStatus(this.curDragNode.getComponent(sp.Skeleton), 0, DragAnimStatus.IDLE, false);
            } else {
                //吸附成功，拖拽物播放stick动效
                this.updateAnimaStatus(this.curDragNode.getComponent(sp.Skeleton), 0, DragAnimStatus.STICK, false);
            }

            //更新吸附区动效状态
            this.updateAdsorptionAnimStatus(AdsorptionAnimStatus.IDLE);

            this.curDragNode.zIndex = this.curDragNode.zIndex - 100;
            this.curDragNode = null;
            this.isTouched = false;
            this.curDragIndex = 0;
            this.submitBtnNode.active = this.checkIsShowSubmitBtn();
        }
    }

    getAdsorptionByIndex(dragNodeIndex){
        for (let index = 0; index < this.adsorptionDataList.length; index++) {
            const adsorptionData = this.adsorptionDataList[index];
            if(dragNodeIndex!= 0 && adsorptionData.currentIndex == dragNodeIndex){
                return  {"adsorptionData":adsorptionData, "adsorptionNode":this.adsorptionNodeList[index]}  ;
            }
        } 
        return null;

    }

    //更新吸附区动画特效
    updateAdsorptionAnimStatus(animaStatus: AdsorptionAnimStatus) {
        
        for (let index = 0; index < this.adsorptionDataList.length; index++) {
            const adsorptionNode = this.adsorptionNodeList[index]["adsorptionAnim"];
            this.updateAnimaStatus(adsorptionNode.getComponent(sp.Skeleton), 0, animaStatus, false)
        }
    }

    // 播放动效
    updateAnimaStatus(skeleton: sp.Skeleton, trackIndex: number = 0, animaName1, isLoop, animaName2?: string) {
        skeleton.setAnimation(trackIndex, animaName1, isLoop);
        if (animaName2) {
            skeleton.setCompleteListener((trackEntry, loopCount) => {
                var aniName = trackEntry.animation ? trackEntry.animation.name : "";
                if (aniName == animaName1) {
                    skeleton.setAnimation(0, animaName2, false);
                }
            });
        }
    }

    //检测是否可以展示提交按钮
    checkIsShowSubmitBtn() {

        let showSubmitBtn = true;
        for (let index = 0; index < this.adsorptionDataList.length; index++) {
            const curAdsorptionData = this.adsorptionDataList[index];
            if (curAdsorptionData.currentIndex === 0) {
                showSubmitBtn = false;
                break;
            }
        }
        return showSubmitBtn;
    }

    // 提交
    onSubmitBtnClick() {
        let isRight = true;

        for (let index = 0; index < this.adsorptionDataList.length; index++) {
            const curAdsorptionData = this.adsorptionDataList[index];

            const targetIndex = curAdsorptionData["targetIndex"];
            const currentIndex = curAdsorptionData["currentIndex"];
            console.log("wztest onSubmitBtnClick ", curAdsorptionData, targetIndex, currentIndex);
            if (targetIndex == 0 || currentIndex == 0 || targetIndex !== currentIndex) {
                isRight = false;
                break;
            }
        }
        if (!isRight) {
            this.wrongLogic();
        } else {
            this.doRightAnima();
        }
    }

    doRightAnima() {
        // 数独未完成播放正常音效
        if (ConfigHelper.isUsable('success_sound', this.parseData)) {
            this.playEffect(RESOURCES, this.parseData.success_sound);
        }
        // 完成
        this.answerFinish();
        this._closeInteractive();
        let hasPlaySucceedAnim = false;
        for (let index = 0; index < this.adsorptionDataList.length; index++) {
            const curAdsorptionData = this.adsorptionDataList[index];
            const curAdsorptionNodeParam = this.adsorptionNodeList[index]

            const targetIndex = curAdsorptionData["targetIndex"];
            const currentIndex = curAdsorptionData["currentIndex"];
            console.log("wztest onSubmitBtnClick ", curAdsorptionData, targetIndex, currentIndex);

            if (targetIndex != 0 && currentIndex != 0 && targetIndex === currentIndex) {
                const adsorptionNode = curAdsorptionNodeParam["adsorptionAnim"];
                const curAnimNode = this.dragAnimaList[currentIndex-1]["animNode"];

                // 播放吸附框成功特效
                this.updateAnimaStatus(adsorptionNode.getComponent(sp.Skeleton), 0, AdsorptionAnimStatus.CORRECT, false, AdsorptionAnimStatus.IDLE);

                //播放拖拽物特效
                
                curAnimNode.getComponent(sp.Skeleton).setAnimation(0, DragAnimStatus.CORRECT, false);
                curAnimNode.getComponent(sp.Skeleton).setCompleteListener((trackEntry, loopCount) => {
                    var aniName = trackEntry.animation ? trackEntry.animation.name : "";
                    if (aniName == DragAnimStatus.CORRECT) {
                        curAnimNode.getComponent(sp.Skeleton).setAnimation(0, DragAnimStatus.END, false);

                        if (this.parseData.success_ani && !hasPlaySucceedAnim) {
                            hasPlaySucceedAnim = true;
                            this.succeedAnima.active = true;
                            this.succeedAnima.getComponent(sp.Skeleton).setAnimation(0, 'correct', false);
                            //正确动画
                            this.succeedAnima.getComponent(sp.Skeleton).setCompleteListener((trackEntry, loopCount) => {
                                var aniName = trackEntry.animation ? trackEntry.animation.name : "";
                                if (aniName === "correct") {
                                    this.succeedAnima.active = false;
                                    this.resetPage();
                                    this._nextQuestion(false);
                                }
                            });
                        }
                    }
                });
            }
        }
    }

    protected _questionEnd() {
        super._questionEnd();
        this._closeInteractive();
    }

    protected wrongLogic(): void {
        super.wrongLogic();
        //啊哦
        this.playEffect(this.bundleName, 'clickError');

        for (let index = 0; index < this.adsorptionDataList.length; index++) {
            const curAdsorptionData = this.adsorptionDataList[index];
            const curAdsorptionNodeData = this.adsorptionNodeList[index]
            const adsorptionNode = curAdsorptionNodeData["adsorptionAnim"];
            const targetIndex = curAdsorptionData["targetIndex"];
            const currentIndex = curAdsorptionData["currentIndex"];
            console.log("wztest onSubmitBtnClick ", this.adsorptionDataList, targetIndex, currentIndex);

            if (targetIndex == 0 || currentIndex == 0 || targetIndex !== currentIndex) {
                this.updateAnimaStatus(adsorptionNode.getComponent(sp.Skeleton), 0, "error", false, "idle")
            }
        }
    }

    // 自动播放音效
    autoPlayAudio() {
        if (ConfigHelper.isUsable("auto_play_title", this.curData)) {
            this.playTitleVoice();
        }
        if (ConfigHelper.isUsable("bgm", this.curData)) {
            this.playMusic(RESOURCES, this.curData.bgm, true);
        }
    }

    // reset 页面
    resetPage() {


        this.curDragNode = null;                // 当前拖拽的节点
        this.dragAnimaCount = 0;                 //拖拽动效数量
        this.adsorptionAnimCount = 0;            //吸附区动画
        this.dragAnimaList = [];                    //拖拽物列表
        this.curDragIndex = 0;
        this.adsorptionDataList = [];             //吸附区动效列表

        this.adsorptionNodeList = [];
        // this.cusRemoveChildren(this.DragArea);
        // this.cusRemoveChildren(this.TargetArea);
    }

    // 自定义remove
    cusRemoveChildren(node) {
        node.children.forEach((item) => {
            if (item.name !== "tempNode") {
                item.destroy();
            }
        });
    }

    // 断线重连机制
    getRequestDataFunc() {
        super.getRequestDataFunc();
        let data = {
            curID: this.curID,
            answeredList: this.answeredList,
        };
        return data;
    }
    // 断线接收数据
    async refreshUIFunc(data) {
        if (data.curID && Number(this.curID) != Number(data.curID)) {
            this.curID = data.curID;
            await this.restartCom();
        }

        const { answeredList } = data;
        this.answeredList = answeredList.concat();
        if (answeredList && answeredList.length > 0) {
            this.curQuestionIndex = answeredList.length;
            // this.reRenderDragArea(answeredList);
        }
    }

    // 是否在目标区
    checkIsInTarget(targetNode: cc.Node) {
        const targetRect = targetNode.getBoundingBoxToWorld();
        const dragRect = this.curDragNode.parent.convertToWorldSpaceAR(this.curDragNode.position);
        const curPosVec2 = cc.v2(dragRect.x, dragRect.y);
        if (targetRect.contains(curPosVec2)) {
            return true;
        }
        return false;
    }
    // 是否答题正确
    checkIsRight(dragNode: cc.Node, targetNode: cc.Node) {
        const dragId = dragNode.name;
        const targetId = targetNode.name;
        return dragId === targetId;
    }

    //绑定音频
    bindVoiceEvent() {
        this.HeadArea.on(cc.Node.EventType.TOUCH_END, this.playTitleVoice, this);
    }

    playTitleVoice() {
        let ret = ConfigHelper.isUsable("title_sound", this.curData);
        if (ret) {
            this.titleSound = this.curData.title_sound;
            const laba = this.HeadArea.getChildByName("laba");
            const Skeleton = laba.getComponent(sp.Skeleton);
            this.stopAllEffect();
            Skeleton.paused = false;

            this.playEffect(
                RESOURCES,
                this.titleSound,
                (event: MusicEvent) => {
                    if (event == MusicEvent.STARTED) {
                        Skeleton.setAnimation(0, "touch1", true);
                    } else if (event == MusicEvent.ENDED) {
                        Skeleton.setAnimation(0, "standby", false);
                    }
                },
                false
            );
        }
    }

}
