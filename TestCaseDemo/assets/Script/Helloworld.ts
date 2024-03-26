
const { ccclass, property } = cc._decorator;

@ccclass
export default class Helloworld extends cc.Component {

    @property(cc.Node)
    matrixContainer: cc.Node = null;

    @property(cc.Node)
    blockDemo: cc.Node = null;


    @property(cc.EditBox)
    inputX: cc.EditBox = null;

    @property(cc.EditBox)
    inputY: cc.EditBox = null;

    @property(cc.Node)
    playNode: cc.Node = null;

    @property(cc.Node)
    tipNode: cc.Node = null;

    // @property(cc.Node)
    // tipNode: cc.Node = null;

    x: number = 0;
    y: number = 0;

    // 初始化矩阵
    matrix: string[][] = [];


    colors: string[] = ['Red', 'Green', 'Blue', 'Yellow', 'Purple'];

    start() {
        // 添加按钮点击事件
        const button = this.node.getChildByName("GenerateBtn");
        button.on(cc.Node.EventType.TOUCH_END, this.generateMatrix, this);

        const playBtnIn = this.node.getChildByName("playBtnIn");
        playBtnIn.on(cc.Node.EventType.TOUCH_END, this.onPlayBtnIn, this);

        const playBtn = this.node.getChildByName("playBtn");
        playBtn.on(cc.Node.EventType.TOUCH_START, this.onPlayBtnTouchStart, this);
        playBtn.on(cc.Node.EventType.TOUCH_END, this.onPlayBtnTouchEnd, this);

        this.playNode.scale = 0;
        this.playNode.opacity = 0;
        this.playNode.angle = -5;
    }

    generateMatrix() {

        // 清空矩阵容器
        this.matrixContainer.destroyAllChildren();

        // 获取输入的X和Y值
        this.x = parseInt(this.inputX.string);
        this.y = parseInt(this.inputY.string);

        // 确保X和Y的合法性
        if (isNaN(this.x) || isNaN(this.y) || this.x <= 0 || this.y <= 0) {
            cc.error("Invalid input values.");
            this.tipNode.active = true;
            this.scheduleOnce(()=>{
                this.tipNode.active = false;
            },2)
            return;
        }

        // 生成矩阵
        let colorIndex = Math.floor(Math.random() * this.colors.length); // 随机选择第一个颜色
        for (let m = 0; m < 10; m++) {
            this.matrix[m] = [];
            for (let n = 0; n < 10; n++) {
                const cell = cc.instantiate(this.blockDemo)
                cell.active = true;
                cell.color = this.getColorIndex(m, n);
                cell.setPosition(m * 50, n * 50);
                this.matrixContainer.addChild(cell);
            }
        }
    }

    // 辅助函数，用于计算颜色概率
    getColorProbabilities(previousColor: string, adjacentColor: string): string[] {
        const probabilities: string[] = [];
        //颜色初始概率
        let originalBaseProbablity = 100 / 5;
        //颜色实际概率
        let realBaseProblity = 100 / 5;
        //目标块左侧和上方块的颜色的概率
        let targetProbilty = 20;

        if (previousColor === adjacentColor) {
            //若(m, n - 1)和(m - 1 ,n)同⾊，则该颜⾊的概率只增加 Y%
            realBaseProblity = (100 - originalBaseProbablity - this.y) / (this.colors.length - 1);
            targetProbilty = originalBaseProbablity + this.y;
        } else if (previousColor != null && adjacentColor !== null) {
            //(m, n - 1)所属颜⾊的概率增加 X%
            //(m - 1, n)所属颜⾊的概率增加 X%
            realBaseProblity = (100 - originalBaseProbablity * 2 - this.x - this.x) / (this.colors.length - 2);
            targetProbilty = originalBaseProbablity + this.x;
        } else {
            //目标块左侧和上方有一个为null
            realBaseProblity = (100 - originalBaseProbablity - this.x) / (this.colors.length - 1);
            targetProbilty = originalBaseProbablity + this.x;
        }

        for (const color of this.colors) {
            if (color === previousColor || color === adjacentColor) {
                // probabilities.push(color);
                for (let i = 0; i < targetProbilty; i++) {
                    probabilities.push(color);
                }
            } else {
                for (let i = 0; i < realBaseProblity; i++) {
                    probabilities.push(color);
                }
            }
        }


        return probabilities;
    }

    getColorIndex(m, n) {
        let colorProbabilities: string[];
        if (m === 0 && n === 0) {
            //第一个点随机选择颜色
            colorProbabilities = this.colors;
        } else {
            // 获取相邻点的颜色
            const leftColor = n > 0 ? this.matrix[m][n - 1] : null;
            const topColor = m > 0 ? this.matrix[m - 1][n] : null;

            // 根据规则计算颜色概率
            colorProbabilities = this.getColorProbabilities(leftColor, topColor);
        }
        const randomIndex = Math.floor(Math.random() * colorProbabilities.length);
        const selectColor = colorProbabilities[randomIndex];
        this.matrix[m][n] = selectColor;
        return this.switchColorIndex(selectColor);

    }

    switchColorIndex(colorStr: string) {
        let colorIndex = this.colors.indexOf(colorStr);
        let color: cc.Color = cc.Color.RED;
        switch (colorIndex) {
            case 0:
                color = cc.Color.RED;
                break;
            case 1:
                color = cc.Color.GREEN;
                break;
            case 2:
                color = cc.Color.BLUE;
                break;
            case 3:
                color = cc.Color.YELLOW;
                break;
            case 4:
                color = cc.Color.ORANGE;
                break;
            default:
                color = cc.Color.WHITE;

                break;
        }

        return color
    }

    //***********************第二题********************************************************** */
    //时间复杂度 O(n)
    question2(a: number[], b: number[], v: number): boolean {

        let setB: Set<number> = new Set(b);

        for (const num of a) {          //O(n)
            if (setB.has(v - num)) {        //O(1)
                return true;
            }
        }

        return false

    }

    //***********************第三题********************************************************** */
    //play按钮入场
   
    scaleOriginal = 1.0;
    onPlayBtnIn() {
       
        let t = cc.tween;
        t(this.playNode)
        .stop();

    
        t(this.playNode)
            .parallel(
                t().to(0.1, { scaleX: 1.2*this.scaleOriginal ,scaleY:0.8*this.scaleOriginal}, { easing: 'sineOutIn'}),
                t().to(0.1, { angle: 5}),
                t().to(0.1, { opacity: 255}, { easing: 'sineOutIn'}),

            )
            .parallel(
                t().to(0.1, { scaleX: 0.8*this.scaleOriginal,scaleY:1.0*this.scaleOriginal }, { easing: 'sineInOut'}),
                t().to(0.1, { angle: -2 })
            )
            .parallel(
                t().to(0.1, { scaleX: 1.2*this.scaleOriginal,scaleY:0.9*this.scaleOriginal }, { easing: 'sineOutIn'}),
                t().to(0.1, { angle: 2 })
            )
            .parallel(
                t().to(0.1, { scaleX: 1.0*this.scaleOriginal,scaleY:1.0*this.scaleOriginal }, { easing: 'sineInOut'}),
                t().to(0.1, { angle: 0 })
            )
            .repeatForever(
                t()
                .to(0.6, {scaleX: 1.02*this.scaleOriginal,scaleY:0.96*this.scaleOriginal })
                .to(0.6, { scaleX:  0.96*this.scaleOriginal,scaleY:1.02*this.scaleOriginal  })
            )
            .start()
    }

    //play按钮选中
    onPlayBtnTouchStart() {
        this.scaleOriginal = 0.8
        this.onPlayBtnIn();
    }

    //play按钮弹开
    onPlayBtnTouchEnd() {
        this.scaleOriginal = 1.0
        this.onPlayBtnIn();
    }

}