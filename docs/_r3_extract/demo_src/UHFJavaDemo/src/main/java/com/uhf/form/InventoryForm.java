/*
 * Created by JFormDesigner on Mon Oct 17 16:03:40 CST 2022
 */

package com.uhf.form;

import java.awt.event.*;


import com.rscja.deviceapi.ConnectionState;
import com.rscja.deviceapi.entity.UHFTAGInfo;
import com.rscja.deviceapi.interfaces.IUHF;
import com.rscja.deviceapi.interfaces.IUHFInventoryCallback;
import com.rscja.deviceapi.interfaces.IUR4;
import com.uhf.UHFMainForm;
import com.uhf.model.InventoryTableModel;
import com.uhf.utils.StringUtils;


import java.awt.*;
import java.lang.reflect.InvocationTargetException;
import javax.swing.*;
import javax.swing.border.*;
import javax.swing.plaf.*;
import javax.swing.table.*;

/**
 * @author zp
 */
public class InventoryForm extends JPanel {
    boolean isRuning = false;
    private int totalCount; //总次数
    private long totalTime;//总时间
    private long startReadTime;//开始时间

    private InventoryTableModel inventoryTableModel = new InventoryTableModel();

    public InventoryForm() {
        initComponents();
        initUI();
    }

    public void initUI() {
        if(UHFMainForm.isEnglish()){
            label1.setText("Tag Data:");
            label2.setText("Ptr");
            label3.setText("Len");
            btnSetFilter.setText("SetFilter");
            btnReset.setText("CloseFilter");
            label4.setText("Labels:");
            label7.setText("Count:");
            label8.setText("Time:");
            label11.setText("WorkTime:");
            btnStartStop.setText("AUTO");
            btnClear.setText("CLEAR");
            label10.setText("s");
            label12.setText("s");
            TitledBorder titledBorder=new TitledBorder("Filter");
            panel3.setBorder(titledBorder);
        }


        table1.setModel(inventoryTableModel);
        table1.getColumn(table1.getColumnName(0)).setPreferredWidth(10);
        table1.getColumn(table1.getColumnName(1)).setPreferredWidth(200); // EPC列宽
        table1.getColumn(table1.getColumnName(2)).setPreferredWidth(150); // TID列宽
        DefaultTableCellRenderer renderer = new DefaultTableCellRenderer();
        renderer.setHorizontalAlignment(JTextField.CENTER);
        table1.getColumn(table1.getColumnName(3)).setCellRenderer(renderer); //User
        table1.getColumn(table1.getColumnName(4)).setPreferredWidth(10);//rssi
        table1.getColumn(table1.getColumnName(5)).setPreferredWidth(10);//数量
        table1.getColumn(table1.getColumnName(6)).setPreferredWidth(10);//数量

        rbFilterEpc.setSelected(true);
        rbFilterUser.setSelected(false);
        rbFliterTid.setSelected(false);
    }

    /**
     * 设置过滤
     *
     * @param e
     */
    private void btnSetFilterActionPerformed(ActionEvent e) {
        String start = txtFilterStart.getText();
        String len = txtFilterLen.getText();
        String data = txtFilterData.getText();
        if(StringUtils.isEmpty(start)){
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish() ? "Start address cannot be empty !" : "起始地址不能为空!","", JOptionPane.ERROR_MESSAGE);
            return;
        }
        if(StringUtils.isEmpty(len)){
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish() ? "The data length cannot be empty !" : "数据长度不能为空!","", JOptionPane.ERROR_MESSAGE);
            return;
        }

        int bank = -1;
        if (rbFilterEpc.isSelected()) {
            bank = IUHF.Bank_EPC;
        } else if (rbFliterTid.isSelected()) {
            bank = IUHF.Bank_TID;
        } else if (rbFilterUser.isSelected()) {
            bank = IUHF.Bank_USER;
        }
        if (bank == -1) {
            JOptionPane.showMessageDialog(this,  UHFMainForm.isEnglish() ? "Please select the data area to filter !" : "请选择要过滤的数据区域!","", JOptionPane.ERROR_MESSAGE);
            return;
        }
        boolean result = UHFMainForm.uhf.setFilter(bank, Integer.parseInt(start), Integer.parseInt(len), data);
        if(result){
            JOptionPane.showMessageDialog(this,  UHFMainForm.isEnglish() ? "Set Success !" : "设置成功!","", JOptionPane.ERROR_MESSAGE);
        }else{
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish() ? "Set Fail !" : "设置失败!" ,"", JOptionPane.ERROR_MESSAGE);
        }
    }

    /**
     * 重置过滤
     *
     * @param e
     */
    private void btnResetActionPerformed(ActionEvent e) {
        boolean result = UHFMainForm.uhf.setFilter(IUHF.Bank_EPC, 0, 0, null);
        if(result){
            JOptionPane.showMessageDialog(this,  UHFMainForm.isEnglish() ? "Set Success !" : "设置成功!","", JOptionPane.ERROR_MESSAGE);
        }else{
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish() ? "Set Fail !" : "设置失败!" ,"", JOptionPane.ERROR_MESSAGE);
        }
    }

    /**
     * 盘点标签
     *
     * @param e
     */
    private void btnStartStopActionPerformed(ActionEvent e) {
        if (UHFMainForm.uhf == null) {
            System.out.println("UHFMainForm.uhf == null !!!");
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish() ? "Failed to start inventory" : "开启盘点失败!","", JOptionPane.ERROR_MESSAGE);
            return;
        }
        //设置盘点回调接口
        UHFMainForm.uhf.setInventoryCallback(new IUHFInventoryCallback() {
            @Override
            public void callback(UHFTAGInfo uhftagInfo) {
                inventoryTableModel.addData(uhftagInfo);
                try {
                    EventQueue.invokeAndWait(new Runnable() {
                        @Override
                        public void run() {
                            table1.updateUI();
                            lblTags.setText(inventoryTableModel.getTagCount() + "");
                            lblCount.setText(inventoryTableModel.getTotal() + "");
                        }
                    });
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        });
        if (btnStartStop.getText().equals(UHFMainForm.isEnglish() ? "AUTO" : "开始盘点")) {
            // System.out.println("UHFMainForm.uhf: " + UHFMainForm.uhf);
            boolean result = UHFMainForm.uhf.startInventoryTag();
            if (!result) {
                JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish() ? "Failed to start inventory" : "开启盘点失败!","", JOptionPane.ERROR_MESSAGE);
                return;
            }
            startInventory();
        } else {
            stopInventory();
        }
    }

    public void startInventory() {
        isRuning = true;
        btnClear.setEnabled(false);
        btnStartStop.setText(UHFMainForm.isEnglish() ? "STOP" : "停止盘点");
        startReadTime = System.currentTimeMillis();

        new Thread() {
            //更新时间的线程
            public void run() {
                String inventoryTimeStr = txtTime.getText();
                int inventoryTime = 0;
                if (inventoryTimeStr != null && !inventoryTimeStr.isEmpty()) {
                    //盘点时间
                    inventoryTime = Integer.parseInt(inventoryTimeStr);
                }
                while (isRuning) {
                    totalTime = (System.currentTimeMillis() - startReadTime) / 1000;
                    lblTime.setText(totalTime + "");
                    try {
                        Thread.sleep(1000);
                    } catch (InterruptedException interruptedException) {
                        interruptedException.printStackTrace();
                    }
                    if (inventoryTime != 0 && totalTime >= inventoryTime) {
                        //如果到达盘点时间则停止盘点
                        stopInventory();
                    }
                }
            }

            ;
        }.start();
    }

    public void stopInventory() {
        isRuning = false;
        btnStartStop.setText(UHFMainForm.isEnglish() ? "AUTO" : "开始盘点");
        if (UHFMainForm.uhf != null)
            UHFMainForm.uhf.stopInventory();
        btnClear.setEnabled(true);
    }

    /**
     * 清空数据
     *
     * @param e
     */
    private void btnClearActionPerformed(ActionEvent e) {
        inventoryTableModel.clear();
        table1.updateUI();
        lblTags.setText(inventoryTableModel.getTagCount() + "");
        lblCount.setText(inventoryTableModel.getTotal() + "");
    }

    /**
     * 过滤EPC
     *
     * @param e
     */
    private void rbFilterEpcActionPerformed(ActionEvent e) {
        rbFilterEpc.setSelected(true);
        rbFilterUser.setSelected(false);
        rbFliterTid.setSelected(false);
    }

    /**
     * 过滤TID
     *
     * @param e
     */
    private void rbFliterTidActionPerformed(ActionEvent e) {
        rbFilterEpc.setSelected(false);
        rbFilterUser.setSelected(false);
        rbFliterTid.setSelected(true);
    }

    /**
     * 过滤 USER
     *
     * @param e
     */
    private void rbFilterUserActionPerformed(ActionEvent e) {
        rbFilterEpc.setSelected(false);
        rbFilterUser.setSelected(true);
        rbFliterTid.setSelected(false);
    }

    @Override
    public void setVisible(boolean aFlag) {
        // TODO Auto-generated method stub
        if (!aFlag) {
            if (btnStartStop.getText().equals(UHFMainForm.isEnglish() ? "STOP" : "停止盘点")) {
                stopInventory();
            }
        }
        super.setVisible(aFlag);
    }

    private void initComponents() {
        // JFormDesigner - Component initialization - DO NOT MODIFY  //GEN-BEGIN:initComponents
        panel1 = new JPanel();
        panel2 = new JPanel();
        panel3 = new JPanel();
        label1 = new JLabel();
        scrollPane2 = new JScrollPane();
        txtFilterData = new JTextArea();
        label2 = new JLabel();
        txtFilterStart = new JTextField();
        label3 = new JLabel();
        txtFilterLen = new JTextField();
        btnSetFilter = new JButton();
        btnReset = new JButton();
        panel4 = new JPanel();
        panel5 = new JPanel();
        rbFilterEpc = new JRadioButton();
        rbFliterTid = new JRadioButton();
        rbFilterUser = new JRadioButton();
        label5 = new JLabel();
        label6 = new JLabel();
        scrollPane1 = new JScrollPane();
        table1 = new JTable();
        label4 = new JLabel();
        lblTags = new JLabel();
        lblCount = new JLabel();
        label7 = new JLabel();
        label8 = new JLabel();
        lblTime = new JLabel();
        label10 = new JLabel();
        label11 = new JLabel();
        txtTime = new JTextField();
        label12 = new JLabel();
        btnStartStop = new JButton();
        btnClear = new JButton();

        //======== this ========
        setLayout(null);

        //======== panel1 ========
        {
            panel1.setLayout(null);

            {
                // compute preferred size
                Dimension preferredSize = new Dimension();
                for(int i = 0; i < panel1.getComponentCount(); i++) {
                    Rectangle bounds = panel1.getComponent(i).getBounds();
                    preferredSize.width = Math.max(bounds.x + bounds.width, preferredSize.width);
                    preferredSize.height = Math.max(bounds.y + bounds.height, preferredSize.height);
                }
                Insets insets = panel1.getInsets();
                preferredSize.width += insets.right;
                preferredSize.height += insets.bottom;
                panel1.setMinimumSize(preferredSize);
                panel1.setPreferredSize(preferredSize);
            }
        }
        add(panel1);
        panel1.setBounds(new Rectangle(new Point(60, 25), panel1.getPreferredSize()));

        //======== panel2 ========
        {
            panel2.setLayout(null);

            {
                // compute preferred size
                Dimension preferredSize = new Dimension();
                for(int i = 0; i < panel2.getComponentCount(); i++) {
                    Rectangle bounds = panel2.getComponent(i).getBounds();
                    preferredSize.width = Math.max(bounds.x + bounds.width, preferredSize.width);
                    preferredSize.height = Math.max(bounds.y + bounds.height, preferredSize.height);
                }
                Insets insets = panel2.getInsets();
                preferredSize.width += insets.right;
                preferredSize.height += insets.bottom;
                panel2.setMinimumSize(preferredSize);
                panel2.setPreferredSize(preferredSize);
            }
        }
        add(panel2);
        panel2.setBounds(70, 105, panel2.getPreferredSize().width, 0);

        //======== panel3 ========
        {
            panel3.setBackground(new Color(238, 238, 238));
            panel3.setBorder(new TitledBorder("\u8fc7\u6ee4"));
            panel3.setLayout(null);

            //---- label1 ----
            label1.setText("\u6807\u7b7e\u6570\u636e:");
            panel3.add(label1);
            label1.setBounds(new Rectangle(new Point(10, 30), label1.getPreferredSize()));

            //======== scrollPane2 ========
            {
                scrollPane2.setViewportView(txtFilterData);
            }
            panel3.add(scrollPane2);
            scrollPane2.setBounds(65, 15, 305, 50);

            //---- label2 ----
            label2.setText("\u8d77\u59cb\u5730\u5740:");
            panel3.add(label2);
            label2.setBounds(new Rectangle(new Point(385, 35), label2.getPreferredSize()));
            panel3.add(txtFilterStart);
            txtFilterStart.setBounds(440, 25, 65, 35);

            //---- label3 ----
            label3.setText("\u957f\u5ea6:");
            panel3.add(label3);
            label3.setBounds(new Rectangle(new Point(545, 35), label3.getPreferredSize()));
            panel3.add(txtFilterLen);
            txtFilterLen.setBounds(575, 25, 60, 35);

            //---- btnSetFilter ----
            btnSetFilter.setText("\u8bbe\u7f6e\u8fc7\u6ee4");
            btnSetFilter.addActionListener(e -> btnSetFilterActionPerformed(e));
            panel3.add(btnSetFilter);
            btnSetFilter.setBounds(890, 25, btnSetFilter.getPreferredSize().width, 40);

            //---- btnReset ----
            btnReset.setText("\u53d6\u6d88\u8fc7\u6ee4");
            btnReset.addActionListener(e -> btnResetActionPerformed(e));
            panel3.add(btnReset);
            btnReset.setBounds(980, 25, btnReset.getPreferredSize().width, 40);

            //======== panel4 ========
            {
                panel4.setMinimumSize(new Dimension(30, 10));
                panel4.setLayout(new BorderLayout());
            }
            panel3.add(panel4);
            panel4.setBounds(730, 30, panel4.getPreferredSize().width, 0);

            //======== panel5 ========
            {
                panel5.setPreferredSize(new Dimension(10, 50));
                panel5.setBorder(LineBorder.createBlackLineBorder());
                panel5.setToolTipText("\u8fc7\u6ee4");
                panel5.setLayout(null);

                //---- rbFilterEpc ----
                rbFilterEpc.setText("EPC");
                rbFilterEpc.addActionListener(e -> rbFilterEpcActionPerformed(e));
                panel5.add(rbFilterEpc);
                rbFilterEpc.setBounds(new Rectangle(new Point(15, 15), rbFilterEpc.getPreferredSize()));

                //---- rbFliterTid ----
                rbFliterTid.setText("Tid");
                rbFliterTid.addActionListener(e -> rbFliterTidActionPerformed(e));
                panel5.add(rbFliterTid);
                rbFliterTid.setBounds(new Rectangle(new Point(80, 15), rbFliterTid.getPreferredSize()));

                //---- rbFilterUser ----
                rbFilterUser.setText("User");
                rbFilterUser.addActionListener(e -> rbFilterUserActionPerformed(e));
                panel5.add(rbFilterUser);
                rbFilterUser.setBounds(new Rectangle(new Point(145, 15), rbFilterUser.getPreferredSize()));

                {
                    // compute preferred size
                    Dimension preferredSize = new Dimension();
                    for(int i = 0; i < panel5.getComponentCount(); i++) {
                        Rectangle bounds = panel5.getComponent(i).getBounds();
                        preferredSize.width = Math.max(bounds.x + bounds.width, preferredSize.width);
                        preferredSize.height = Math.max(bounds.y + bounds.height, preferredSize.height);
                    }
                    Insets insets = panel5.getInsets();
                    preferredSize.width += insets.right;
                    preferredSize.height += insets.bottom;
                    panel5.setMinimumSize(preferredSize);
                    panel5.setPreferredSize(preferredSize);
                }
            }
            panel3.add(panel5);
            panel5.setBounds(670, 20, 215, panel5.getPreferredSize().height);

            //---- label5 ----
            label5.setText("bit");
            panel3.add(label5);
            label5.setBounds(new Rectangle(new Point(510, 35), label5.getPreferredSize()));

            //---- label6 ----
            label6.setText("bit");
            panel3.add(label6);
            label6.setBounds(635, 35, label6.getPreferredSize().width, 17);

            {
                // compute preferred size
                Dimension preferredSize = new Dimension();
                for(int i = 0; i < panel3.getComponentCount(); i++) {
                    Rectangle bounds = panel3.getComponent(i).getBounds();
                    preferredSize.width = Math.max(bounds.x + bounds.width, preferredSize.width);
                    preferredSize.height = Math.max(bounds.y + bounds.height, preferredSize.height);
                }
                Insets insets = panel3.getInsets();
                preferredSize.width += insets.right;
                preferredSize.height += insets.bottom;
                panel3.setMinimumSize(preferredSize);
                panel3.setPreferredSize(preferredSize);
            }
        }
        add(panel3);
        panel3.setBounds(10, 15, 1080, 80);

        //======== scrollPane1 ========
        {

            //---- table1 ----
            table1.setModel(new DefaultTableModel());
            scrollPane1.setViewportView(table1);
        }
        add(scrollPane1);
        scrollPane1.setBounds(10, 120, 1075, 420);

        //---- label4 ----
        label4.setText("\u6807\u7b7e\u5f20\u6570:");
        add(label4);
        label4.setBounds(new Rectangle(new Point(35, 565), label4.getPreferredSize()));

        //---- lblTags ----
        lblTags.setText("0");
        add(lblTags);
        lblTags.setBounds(95, 565, 60, lblTags.getPreferredSize().height);

        //---- lblCount ----
        lblCount.setText("0");
        add(lblCount);
        lblCount.setBounds(290, 565, 115, 17);

        //---- label7 ----
        label7.setText("\u76d8\u70b9\u603b\u6b21\u6570:");
        add(label7);
        label7.setBounds(215, 565, 75, 17);

        //---- label8 ----
        label8.setText("\u65f6\u95f4:");
        add(label8);
        label8.setBounds(410, 565, 52, label8.getPreferredSize().height);

        //---- lblTime ----
        lblTime.setText("0");
        add(lblTime);
        lblTime.setBounds(470, 565, 35, lblTime.getPreferredSize().height);

        //---- label10 ----
        label10.setText("\u79d2");
        add(label10);
        label10.setBounds(new Rectangle(new Point(510, 565), label10.getPreferredSize()));

        //---- label11 ----
        label11.setText("\u76d8\u70b9\u65f6\u95f4:");
        add(label11);
        label11.setBounds(545, 565, 80, label11.getPreferredSize().height);

        //---- txtTime ----
        txtTime.setText("0");
        add(txtTime);
        txtTime.setBounds(620, 560, 95, txtTime.getPreferredSize().height);

        //---- label12 ----
        label12.setText("\u79d2");
        add(label12);
        label12.setBounds(new Rectangle(new Point(720, 565), label12.getPreferredSize()));

        //---- btnStartStop ----
        btnStartStop.setText("\u5f00\u59cb\u76d8\u70b9");
        btnStartStop.addActionListener(e -> btnStartStopActionPerformed(e));
        add(btnStartStop);
        btnStartStop.setBounds(800, 555, 100, 40);

        //---- btnClear ----
        btnClear.setText("\u6e05\u7a7a\u6570\u636e");
        btnClear.addActionListener(e -> btnClearActionPerformed(e));
        add(btnClear);
        btnClear.setBounds(940, 555, 100, 40);

        {
            // compute preferred size
            Dimension preferredSize = new Dimension();
            for(int i = 0; i < getComponentCount(); i++) {
                Rectangle bounds = getComponent(i).getBounds();
                preferredSize.width = Math.max(bounds.x + bounds.width, preferredSize.width);
                preferredSize.height = Math.max(bounds.y + bounds.height, preferredSize.height);
            }
            Insets insets = getInsets();
            preferredSize.width += insets.right;
            preferredSize.height += insets.bottom;
            setMinimumSize(preferredSize);
            setPreferredSize(preferredSize);
        }
        // JFormDesigner - End of component initialization  //GEN-END:initComponents
    }

    // JFormDesigner - Variables declaration - DO NOT MODIFY  //GEN-BEGIN:variables
    private JPanel panel1;
    private JPanel panel2;
    private JPanel panel3;
    private JLabel label1;
    private JScrollPane scrollPane2;
    private JTextArea txtFilterData;
    private JLabel label2;
    private JTextField txtFilterStart;
    private JLabel label3;
    private JTextField txtFilterLen;
    private JButton btnSetFilter;
    private JButton btnReset;
    private JPanel panel4;
    private JPanel panel5;
    private JRadioButton rbFilterEpc;
    private JRadioButton rbFliterTid;
    private JRadioButton rbFilterUser;
    private JLabel label5;
    private JLabel label6;
    private JScrollPane scrollPane1;
    private JTable table1;
    private JLabel label4;
    private JLabel lblTags;
    private JLabel lblCount;
    private JLabel label7;
    private JLabel label8;
    private JLabel lblTime;
    private JLabel label10;
    private JLabel label11;
    private JTextField txtTime;
    private JLabel label12;
    private JButton btnStartStop;
    private JButton btnClear;
    // JFormDesigner - End of variables declaration  //GEN-END:variables
}
