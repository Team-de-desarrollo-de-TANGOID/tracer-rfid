/*
 * Created by JFormDesigner on Mon Oct 17 17:18:30 CST 2022
 */

package com.uhf.form;

import com.rscja.deviceapi.entity.*;
import com.uhf.UHFMainForm;
import com.uhf.utils.StringUtils;

import java.awt.*;
import java.awt.event.*;
import java.util.List;
import javax.swing.*;
import javax.swing.border.*;

/**
 * @author zp
 */
public class ConfigForm extends JPanel {
    public ConfigForm() {
        initComponents();
        initUI();
    }

    /**
     * 获取天线功率
     *
     * @param e
     */
    private void btnGetPowerActionPerformed(ActionEvent e) {
        List<AntennaPowerEntity> list = UHFMainForm.uhf.getPowerAll();
        if(list==null || list.size()==0){
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Get Fail!":"获取失败!", "", JOptionPane.ERROR_MESSAGE);
            return;
        }
        for(AntennaPowerEntity entity:list){
            if(entity.getAntennaNameEnum()==AntennaNameEnum.ANT1){
                cmbAntPower.setSelectedIndex(entity.getPower()-1);
            }else if(entity.getAntennaNameEnum()==AntennaNameEnum.ANT2){
                cmbAntPower2.setSelectedIndex(entity.getPower()-1);
            }else if(entity.getAntennaNameEnum()==AntennaNameEnum.ANT3){
                cmbAntPower3.setSelectedIndex(entity.getPower()-1);
            }else if(entity.getAntennaNameEnum()==AntennaNameEnum.ANT4){
                cmbAntPower4.setSelectedIndex(entity.getPower()-1);
            }
        }

        JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Get Success!":"获取成功!", "", JOptionPane.INFORMATION_MESSAGE);

//        if (index == -1) {
//            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Get Fail!":"获取失败!", "", JOptionPane.ERROR_MESSAGE);
//            return;
//        }
//        cmbAntPower.setSelectedIndex(index-1);
//        JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Get Success!":"获取成功!", "", JOptionPane.INFORMATION_MESSAGE);
    }

    /**
     * 设置天线功率
     *
     * @param e
     */
    private void btnSetPoerActionPerformed(ActionEvent e) {
        int index=cmbAntPower.getSelectedIndex();
        int index2=cmbAntPower2.getSelectedIndex();
        int index3=cmbAntPower3.getSelectedIndex();
        int index4=cmbAntPower4.getSelectedIndex();
        if(index<0 || index2<0 || index3<0 || index4<0){
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Set Fail!":"设置失败!", "", JOptionPane.ERROR_MESSAGE);
            return;
        }
        System.out.println("index="+index);
        boolean result = UHFMainForm.uhf.setPower(AntennaNameEnum.ANT1,index+1);
        boolean result2 = UHFMainForm.uhf.setPower(AntennaNameEnum.ANT2,index2+1);
        boolean result3 = UHFMainForm.uhf.setPower(AntennaNameEnum.ANT3,index3+1);
        boolean result4 = UHFMainForm.uhf.setPower(AntennaNameEnum.ANT4,index4+1);
        if (!result || !result2 || !result3 || !result4) {
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Set Fail!":"设置失败!", "", JOptionPane.ERROR_MESSAGE);
        } else {
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Set Success!":"设置成功!", "", JOptionPane.INFORMATION_MESSAGE);
        }
    }

    /**
     * 获取频段
     *
     * @param e
     */
    private void btnGetFrequencyBandActionPerformed(ActionEvent e) {
        int region = UHFMainForm.uhf.getFrequencyMode();
        switch (region) {
            case 0x01:
                cbFrequencyBand.setSelectedIndex(0);
                break;
            case 0x02:
                cbFrequencyBand.setSelectedIndex(1);
                break;
            case 0x04:
                cbFrequencyBand.setSelectedIndex(2);
                break;
            case 0x08:
                cbFrequencyBand.setSelectedIndex(3);
                break;
            case 0x16:
                cbFrequencyBand.setSelectedIndex(4);
                break;
            case 0x32:
                cbFrequencyBand.setSelectedIndex(5);
                break;
            case 0x34:
                cbFrequencyBand.setSelectedIndex(6);
                break;
            case 0x33:
                cbFrequencyBand.setSelectedIndex(7);
                break;
            case 0x36:
                cbFrequencyBand.setSelectedIndex(8);
                break;
            case 0x37:
                cbFrequencyBand.setSelectedIndex(9);
                break;
            default:
                JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Get Fail!":"获取失败!", "", JOptionPane.ERROR_MESSAGE);
                break;

        }
    }

    /**
     * 设置频段
     *
     * @param e
     */
    private void btnSetFrequencyBandActionPerformed(ActionEvent e) {

        int region = -1;
        switch (cbFrequencyBand.getSelectedIndex()) {
            case 0:
                region = 0x01;
                break;
            case 1:
                region = 0x02;
                break;
            case 2:
                region = 0x04;
                break;
            case 3:
                region = 0x08;
                break;
            case 4:
                region = 0x16;
                break;
            case 5:
                region = 0x32;
                break;
            case 6:
                region = 0x34;
                break;
            case 7:
                region = 0x33;
                break;
            case 8:
                region = 0x36;
                break;
            case 9:
                region = 0x37;
                break;

        }
        if (region == -1) {
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Set Fail!":"设置失败!", "", JOptionPane.ERROR_MESSAGE);
            return;
        }
        boolean result = UHFMainForm.uhf.setFrequencyMode((byte) region);
        if (result) {
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Set Success!":"设置成功!", "", JOptionPane.INFORMATION_MESSAGE);
            return;
        } else {
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Set Fail!":"设置失败!", "", JOptionPane.ERROR_MESSAGE);
            return;
        }
    }

    /**
     * 设置协议
     *
     * @param e
     */
    private void btnSetProtocolActionPerformed(ActionEvent e) {
        int p = cmbProtocol.getSelectedIndex();
        if (p <= 0) {
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Set Fail!":"设置失败!", "", JOptionPane.ERROR_MESSAGE);
            return;
        }
        boolean result = UHFMainForm.uhf.setProtocol(p);
        if (result) {
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Set Success!":"设置成功!", "", JOptionPane.INFORMATION_MESSAGE);
        } else {
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Set Fail!":"设置失败!", "", JOptionPane.ERROR_MESSAGE);
        }
    }

    /**
     * 获取协议
     *
     * @param e
     */
    private void btnGetProtocolActionPerformed(ActionEvent e) {
        int result = UHFMainForm.uhf.getProtocol();
        if (result == -1) {
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Get Fail!":"获取失败!", "", JOptionPane.ERROR_MESSAGE);
            return;
        }
        cmbProtocol.setSelectedIndex(result);
        JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Get Success!":"获取成功!", "", JOptionPane.INFORMATION_MESSAGE);
    }

    /**
     * 获取链路
     *
     * @param e
     */
    private void btnGetLinkActionPerformed(ActionEvent e) {
        int result = UHFMainForm.uhf.getRFLink();
        if (result == -1) {
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Set Fail!":"设置失败!", "", JOptionPane.ERROR_MESSAGE);
            return;
        }
        cmbRFLink.setSelectedIndex(result);
        JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Get Success!":"获取成功!", "", JOptionPane.INFORMATION_MESSAGE);
    }

    /**
     * 设置链路
     *
     * @param e
     */
    private void btnSetLinkActionPerformed(ActionEvent e) {
        int l = cmbRFLink.getSelectedIndex();
        if (l < 0) {
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Set Fail!":"设置失败!", "", JOptionPane.ERROR_MESSAGE);
            return;
        }
        boolean result = UHFMainForm.uhf.setRFLink(l);
        if (!result) {
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Set Fail!":"设置失败!", "", JOptionPane.ERROR_MESSAGE);
            return;
        }
        JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Set Success!":"设置成功!", "", JOptionPane.INFORMATION_MESSAGE);
    }


    /**
     * 获取盘点模式
     *
     * @param e
     */
    private void btnGetEPCAndTIDUserModeActionPerformed(ActionEvent e) {
        InventoryModeEntity result = UHFMainForm.uhf.getEPCAndTIDUserMode();
        if (result == null) {
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Get Fail!":"获取失败!", "", JOptionPane.ERROR_MESSAGE);
            return;
        }
        int User_prt = result.getUserOffset();
        int User_len = result.getUserLength();
        cmbEPCAndTIDUserMode.setSelectedIndex(result.getMode());
        if (result.getMode() == 2) {
            tf_user_prt.setText(String.valueOf(User_prt));
            tf_user_len.setText(String.valueOf(User_len));
        } else {
            tf_user_prt.setText("");
            tf_user_len.setText("");
        }
        JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Get Success!":"获取成功!", "", JOptionPane.INFORMATION_MESSAGE);
    }

    /**
     * 设置盘点模式
     *
     * @param e
     */
    private void btnSetEPCAndTIDUserModeActionPerformed(ActionEvent e) {
        if (cmbEPCAndTIDUserMode.getSelectedIndex() == 0) {
            boolean result1 = UHFMainForm.uhf.setEPCMode();
            if (!result1) {
                JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Set Fail!":"设置失败!", "", JOptionPane.ERROR_MESSAGE);
            } else {
                JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Set Success!":"设置成功!", "", JOptionPane.INFORMATION_MESSAGE);
            }
        } else if (cmbEPCAndTIDUserMode.getSelectedIndex() == 1) {
            boolean result2 = UHFMainForm.uhf.setEPCAndTIDMode();
            if (!result2) {
                JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Set Fail!":"设置失败!", "", JOptionPane.ERROR_MESSAGE);
            } else {
                JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Set Success!":"设置成功!", "", JOptionPane.INFORMATION_MESSAGE);
            }
        } else if (cmbEPCAndTIDUserMode.getSelectedIndex() == 2) {
            String User_Prt = tf_user_prt.getText();
            String User_Len = tf_user_len.getText();

            if (StringUtils.isEmpty(User_Prt)) {
                JOptionPane.showMessageDialog(this,  UHFMainForm.isEnglish()?"Start address cannot be empty":"起始地址不能为空", "", JOptionPane.WARNING_MESSAGE);
                return;
            }
            if (StringUtils.isEmpty(User_Len)) {
                JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"SLength cannot be empty":"长度不能为空", "", JOptionPane.WARNING_MESSAGE);
                return;
            }
            boolean result3 = UHFMainForm.uhf.setEPCAndTIDUserMode(Integer.parseInt(User_Prt), Integer.parseInt(User_Len));
            if (result3) {
                JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Set Success!":"设置成功!", "", JOptionPane.INFORMATION_MESSAGE);
            } else {
                JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Set Fail!":"设置失败!", "", JOptionPane.ERROR_MESSAGE);
            }
        }
    }

    /**
     * 获取蜂鸣器
     *
     * @param e
     */
    private void btnGetBeepActionPerformed(ActionEvent e) {
        char[] result = UHFMainForm.uhf.getBeep();
        // System.out.println(String.valueOf(result));
        if (result == null || result[0] != 0) {
            rbtn_Beep_On.setSelected(false);
            rbtn_Beep_Off.setSelected(true);
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Get Fail!":"获取失败!", "", JOptionPane.ERROR_MESSAGE);
        } else {
            if (result[1] == 1) {
                rbtn_Beep_On.setSelected(true);
                rbtn_Beep_Off.setSelected(false);
            } else {
                rbtn_Beep_On.setSelected(false);
                rbtn_Beep_Off.setSelected(true);
            }
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Get Success!":"获取成功!", "", JOptionPane.INFORMATION_MESSAGE);
        }
    }

    /**
     * 设置蜂鸣器
     *
     * @param e
     */
    private void btnSetBeepActionPerformed(ActionEvent e) {
        int mode = -1;
        if (rbtn_Beep_On.isSelected()) {
            mode = 1;
        } else if (rbtn_Beep_Off.isSelected()) {
            mode = 0;
        }
        boolean result = UHFMainForm.uhf.setBeep(mode);
        if (result) {
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Set Success!":"设置成功!", "", JOptionPane.INFORMATION_MESSAGE);
        } else {
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Set Fail!":"设置失败!", "", JOptionPane.ERROR_MESSAGE);
        }

    }

    /**
     * 蜂鸣器 开
     *
     * @param e
     */
    private void rbtn_Beep_OnActionPerformed(ActionEvent e) {
        rbtn_Beep_On.setSelected(true);
        rbtn_Beep_Off.setSelected(false);
    }

    /**
     * 蜂鸣器 关
     *
     * @param e
     */
    private void rbtn_Beep_OffActionPerformed(ActionEvent e) {
        rbtn_Beep_On.setSelected(false);
        rbtn_Beep_Off.setSelected(true);
    }

    /**
     * 获取Gen2
     *
     * @param e
     */
    private void btnGetGen2ActionPerformed(ActionEvent e) {
        Gen2Entity getGen2 = UHFMainForm.uhf.getGen2();
        if (getGen2 == null) {
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Get Fail!":"获取失败!", "", JOptionPane.ERROR_MESSAGE);
            return;
        }
        int session = getGen2.getQuerySession();
        int target = getGen2.getQueryTarget();
        cmb_Gen2_session.setSelectedIndex(session);
        cmb_Gen2_target.setSelectedIndex(target);
        JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Get Success!":"获取成功!", "", JOptionPane.INFORMATION_MESSAGE);
    }

    /**
     * 设置Gen2
     *
     * @param e
     */
    private void btnSetGen2ActionPerformed(ActionEvent e) {
        Gen2Entity entity = UHFMainForm.uhf.getGen2();
        int session = cmb_Gen2_session.getSelectedIndex();
        int target = cmb_Gen2_target.getSelectedIndex();
        entity.setQuerySession(session);
        entity.setQueryTarget(target);

        boolean result = UHFMainForm.uhf.setGen2(entity);
        if (!result) {
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Set Fail!":"设置失败!", "", JOptionPane.ERROR_MESSAGE);
        } else {
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"Set Success!":"设置成功!", "", JOptionPane.INFORMATION_MESSAGE);
        }
    }

    private void btnIDActionPerformed(ActionEvent e) {
        String id= UHFMainForm.uhf.getDeviceID();
        if (id!=null && id.length()>0) {
            JOptionPane.showMessageDialog(this, "id:"+id, "", JOptionPane.ERROR_MESSAGE);
        } else {
            JOptionPane.showMessageDialog(this, "Fail", "", JOptionPane.INFORMATION_MESSAGE);
        }
    }


    private void initComponents() {
        // JFormDesigner - Component initialization - DO NOT MODIFY  //GEN-BEGIN:initComponents
        panel1 = new JPanel();
        label1 = new JLabel();
        cmbAntPower = new JComboBox();
        btnGetPower = new JButton();
        btnSetPoer = new JButton();
        cmbAntPower2 = new JComboBox();
        label2 = new JLabel();
        label3 = new JLabel();
        cmbAntPower3 = new JComboBox();
        cmbAntPower4 = new JComboBox();
        label4 = new JLabel();
        panel3 = new JPanel();
        label5 = new JLabel();
        cbFrequencyBand = new JComboBox();
        btnGetFrequencyBand = new JButton();
        btnSetFrequencyBand = new JButton();
        panel5 = new JPanel();
        label6 = new JLabel();
        cmbProtocol = new JComboBox();
        btnSetProtocol = new JButton();
        btnGetProtocol = new JButton();
        panel17 = new JPanel();
        label22 = new JLabel();
        cmbEPCAndTIDUserMode = new JComboBox();
        btnGetEPCAndTIDUserMode = new JButton();
        btnSetEPCAndTIDUserMode = new JButton();
        label23 = new JLabel();
        tf_user_prt = new JTextField();
        label24 = new JLabel();
        tf_user_len = new JTextField();
        panel18 = new JPanel();
        label25 = new JLabel();
        cmb_Gen2_session = new JComboBox();
        label26 = new JLabel();
        cmb_Gen2_target = new JComboBox();
        btnSetGen2 = new JButton();
        btnGetGen2 = new JButton();
        panel19 = new JPanel();
        label27 = new JLabel();
        rbtn_Beep_On = new JRadioButton();
        rbtn_Beep_Off = new JRadioButton();
        btnGetBeep = new JButton();
        btnSetBeep = new JButton();
        panel23 = new JPanel();
        cmbRFLink = new JComboBox();
        label7 = new JLabel();
        btnSetRFLink = new JButton();
        btnGetRFLink = new JButton();
        btnID = new JButton();

        //======== this ========
        setLayout(null);

        //======== panel1 ========
        {
            panel1.setPreferredSize(new Dimension(42, 42));
            panel1.setBorder(new TitledBorder("\u529f\u7387"));
            panel1.setLayout(null);

            //---- label1 ----
            label1.setText("ANT1:");
            panel1.add(label1);
            label1.setBounds(15, 20, 50, label1.getPreferredSize().height);
            panel1.add(cmbAntPower);
            cmbAntPower.setBounds(55, 15, 80, cmbAntPower.getPreferredSize().height);

            //---- btnGetPower ----
            btnGetPower.setText("\u83b7\u53d6");
            btnGetPower.addActionListener(e -> btnGetPowerActionPerformed(e));
            panel1.add(btnGetPower);
            btnGetPower.setBounds(65, 70, 65, 30);

            //---- btnSetPoer ----
            btnSetPoer.setText("\u8bbe\u7f6e");
            btnSetPoer.addActionListener(e -> btnSetPoerActionPerformed(e));
            panel1.add(btnSetPoer);
            btnSetPoer.setBounds(160, 70, 65, 30);
            panel1.add(cmbAntPower2);
            cmbAntPower2.setBounds(180, 15, 80, 30);

            //---- label2 ----
            label2.setText("ANT2:");
            panel1.add(label2);
            label2.setBounds(140, 20, 50, 17);

            //---- label3 ----
            label3.setText("ANT3:");
            panel1.add(label3);
            label3.setBounds(15, 45, 50, 17);
            panel1.add(cmbAntPower3);
            cmbAntPower3.setBounds(55, 40, 80, 30);
            panel1.add(cmbAntPower4);
            cmbAntPower4.setBounds(180, 40, 80, 30);

            //---- label4 ----
            label4.setText("ANT4:");
            panel1.add(label4);
            label4.setBounds(140, 45, 50, 17);

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
        panel1.setBounds(15, 10, 325, 105);

        //======== panel3 ========
        {
            panel3.setPreferredSize(new Dimension(42, 42));
            panel3.setBorder(new TitledBorder("\u9891\u6bb5"));
            panel3.setLayout(null);

            //---- label5 ----
            label5.setText("\u9891\u6bb5:");
            panel3.add(label5);
            label5.setBounds(15, 30, 40, 17);
            panel3.add(cbFrequencyBand);
            cbFrequencyBand.setBounds(55, 25, 220, 30);

            //---- btnGetFrequencyBand ----
            btnGetFrequencyBand.setText("\u83b7\u53d6");
            btnGetFrequencyBand.addActionListener(e -> btnGetFrequencyBandActionPerformed(e));
            panel3.add(btnGetFrequencyBand);
            btnGetFrequencyBand.setBounds(55, 65, 85, 30);

            //---- btnSetFrequencyBand ----
            btnSetFrequencyBand.setText("\u8bbe\u7f6e");
            btnSetFrequencyBand.addActionListener(e -> btnSetFrequencyBandActionPerformed(e));
            panel3.add(btnSetFrequencyBand);
            btnSetFrequencyBand.setBounds(175, 65, 80, 30);

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
        panel3.setBounds(15, 125, 325, 110);

        //======== panel5 ========
        {
            panel5.setPreferredSize(new Dimension(42, 42));
            panel5.setBorder(new TitledBorder("\u534f\u8bae"));
            panel5.setLayout(null);

            //---- label6 ----
            label6.setText("\u534f\u8bae:");
            panel5.add(label6);
            label6.setBounds(5, 30, 55, 17);
            panel5.add(cmbProtocol);
            cmbProtocol.setBounds(60, 25, 220, 30);

            //---- btnSetProtocol ----
            btnSetProtocol.setText("\u8bbe\u7f6e");
            btnSetProtocol.addActionListener(e -> btnSetProtocolActionPerformed(e));
            panel5.add(btnSetProtocol);
            btnSetProtocol.setBounds(160, 65, 80, 30);

            //---- btnGetProtocol ----
            btnGetProtocol.setText("\u83b7\u53d6");
            btnGetProtocol.addActionListener(e -> btnGetProtocolActionPerformed(e));
            panel5.add(btnGetProtocol);
            btnGetProtocol.setBounds(40, 65, 85, 30);

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
        add(panel5);
        panel5.setBounds(15, 250, 325, 110);

        //======== panel17 ========
        {
            panel17.setPreferredSize(new Dimension(42, 42));
            panel17.setBorder(new TitledBorder("\u76d8\u70b9\u6a21\u5f0f"));
            panel17.setLayout(null);

            //---- label22 ----
            label22.setText("\u6a21\u5f0f:");
            panel17.add(label22);
            label22.setBounds(16, 30, 40, 17);
            panel17.add(cmbEPCAndTIDUserMode);
            cmbEPCAndTIDUserMode.setBounds(51, 25, 235, 30);

            //---- btnGetEPCAndTIDUserMode ----
            btnGetEPCAndTIDUserMode.setText("\u83b7\u53d6");
            btnGetEPCAndTIDUserMode.addActionListener(e -> btnGetEPCAndTIDUserModeActionPerformed(e));
            panel17.add(btnGetEPCAndTIDUserMode);
            btnGetEPCAndTIDUserMode.setBounds(55, 105, 85, 30);

            //---- btnSetEPCAndTIDUserMode ----
            btnSetEPCAndTIDUserMode.setText("\u8bbe\u7f6e");
            btnSetEPCAndTIDUserMode.addActionListener(e -> btnSetEPCAndTIDUserModeActionPerformed(e));
            panel17.add(btnSetEPCAndTIDUserMode);
            btnSetEPCAndTIDUserMode.setBounds(170, 105, 80, 30);

            //---- label23 ----
            label23.setText("User\u8d77\u59cb\u5730\u5740:");
            panel17.add(label23);
            label23.setBounds(new Rectangle(new Point(15, 70), label23.getPreferredSize()));
            panel17.add(tf_user_prt);
            tf_user_prt.setBounds(100, 65, 60, 25);

            //---- label24 ----
            label24.setText("User\u957f\u5ea6:");
            panel17.add(label24);
            label24.setBounds(new Rectangle(new Point(175, 70), label24.getPreferredSize()));
            panel17.add(tf_user_len);
            tf_user_len.setBounds(235, 65, 65, 25);

            {
                // compute preferred size
                Dimension preferredSize = new Dimension();
                for(int i = 0; i < panel17.getComponentCount(); i++) {
                    Rectangle bounds = panel17.getComponent(i).getBounds();
                    preferredSize.width = Math.max(bounds.x + bounds.width, preferredSize.width);
                    preferredSize.height = Math.max(bounds.y + bounds.height, preferredSize.height);
                }
                Insets insets = panel17.getInsets();
                preferredSize.width += insets.right;
                preferredSize.height += insets.bottom;
                panel17.setMinimumSize(preferredSize);
                panel17.setPreferredSize(preferredSize);
            }
        }
        add(panel17);
        panel17.setBounds(350, 10, 325, 150);

        //======== panel18 ========
        {
            panel18.setPreferredSize(new Dimension(42, 42));
            panel18.setBorder(new TitledBorder("Gen2"));
            panel18.setLayout(null);

            //---- label25 ----
            label25.setText("Session:");
            panel18.add(label25);
            label25.setBounds(10, 30, 75, 17);
            panel18.add(cmb_Gen2_session);
            cmb_Gen2_session.setBounds(65, 25, 85, 30);

            //---- label26 ----
            label26.setText("Target:");
            panel18.add(label26);
            label26.setBounds(165, 30, 75, 17);
            panel18.add(cmb_Gen2_target);
            cmb_Gen2_target.setBounds(215, 25, 85, 30);

            //---- btnSetGen2 ----
            btnSetGen2.setText("\u8bbe\u7f6e");
            btnSetGen2.addActionListener(e -> btnSetGen2ActionPerformed(e));
            panel18.add(btnSetGen2);
            btnSetGen2.setBounds(175, 70, 80, 30);

            //---- btnGetGen2 ----
            btnGetGen2.setText("\u83b7\u53d6");
            btnGetGen2.addActionListener(e -> btnGetGen2ActionPerformed(e));
            panel18.add(btnGetGen2);
            btnGetGen2.setBounds(55, 70, 85, 30);

            {
                // compute preferred size
                Dimension preferredSize = new Dimension();
                for(int i = 0; i < panel18.getComponentCount(); i++) {
                    Rectangle bounds = panel18.getComponent(i).getBounds();
                    preferredSize.width = Math.max(bounds.x + bounds.width, preferredSize.width);
                    preferredSize.height = Math.max(bounds.y + bounds.height, preferredSize.height);
                }
                Insets insets = panel18.getInsets();
                preferredSize.width += insets.right;
                preferredSize.height += insets.bottom;
                panel18.setMinimumSize(preferredSize);
                panel18.setPreferredSize(preferredSize);
            }
        }
        add(panel18);
        panel18.setBounds(350, 170, 325, 115);

        //======== panel19 ========
        {
            panel19.setPreferredSize(new Dimension(42, 42));
            panel19.setBorder(new TitledBorder("\u8702\u9e23\u5668"));
            panel19.setLayout(null);

            //---- label27 ----
            label27.setText("\u8702\u9e23\u5668:");
            panel19.add(label27);
            label27.setBounds(20, 35, 55, 17);

            //---- rbtn_Beep_On ----
            rbtn_Beep_On.setText("\u5f00");
            rbtn_Beep_On.addActionListener(e -> rbtn_Beep_OnActionPerformed(e));
            panel19.add(rbtn_Beep_On);
            rbtn_Beep_On.setBounds(80, 35, 50, rbtn_Beep_On.getPreferredSize().height);

            //---- rbtn_Beep_Off ----
            rbtn_Beep_Off.setText("\u5173");
            rbtn_Beep_Off.addActionListener(e -> rbtn_Beep_OffActionPerformed(e));
            panel19.add(rbtn_Beep_Off);
            rbtn_Beep_Off.setBounds(145, 35, 55, 21);

            //---- btnGetBeep ----
            btnGetBeep.setText("\u83b7\u53d6");
            btnGetBeep.addActionListener(e -> btnGetBeepActionPerformed(e));
            panel19.add(btnGetBeep);
            btnGetBeep.setBounds(55, 80, 85, 30);

            //---- btnSetBeep ----
            btnSetBeep.setText("\u8bbe\u7f6e");
            btnSetBeep.addActionListener(e -> btnSetBeepActionPerformed(e));
            panel19.add(btnSetBeep);
            btnSetBeep.setBounds(180, 80, 80, 30);

            {
                // compute preferred size
                Dimension preferredSize = new Dimension();
                for(int i = 0; i < panel19.getComponentCount(); i++) {
                    Rectangle bounds = panel19.getComponent(i).getBounds();
                    preferredSize.width = Math.max(bounds.x + bounds.width, preferredSize.width);
                    preferredSize.height = Math.max(bounds.y + bounds.height, preferredSize.height);
                }
                Insets insets = panel19.getInsets();
                preferredSize.width += insets.right;
                preferredSize.height += insets.bottom;
                panel19.setMinimumSize(preferredSize);
                panel19.setPreferredSize(preferredSize);
            }
        }
        add(panel19);
        panel19.setBounds(350, 295, 325, 140);

        //======== panel23 ========
        {
            panel23.setPreferredSize(new Dimension(42, 42));
            panel23.setBorder(new TitledBorder("\u94fe\u8def"));
            panel23.setLayout(null);
            panel23.add(cmbRFLink);
            cmbRFLink.setBounds(60, 25, 220, 30);

            //---- label7 ----
            label7.setText("\u94fe\u8def:");
            panel23.add(label7);
            label7.setBounds(20, 30, 40, 17);

            //---- btnSetRFLink ----
            btnSetRFLink.setText("\u8bbe\u7f6e");
            btnSetRFLink.addActionListener(e -> btnSetLinkActionPerformed(e));
            panel23.add(btnSetRFLink);
            btnSetRFLink.setBounds(155, 65, 80, 30);

            //---- btnGetRFLink ----
            btnGetRFLink.setText("\u83b7\u53d6");
            btnGetRFLink.addActionListener(e -> btnGetLinkActionPerformed(e));
            panel23.add(btnGetRFLink);
            btnGetRFLink.setBounds(35, 65, 85, 30);

            {
                // compute preferred size
                Dimension preferredSize = new Dimension();
                for(int i = 0; i < panel23.getComponentCount(); i++) {
                    Rectangle bounds = panel23.getComponent(i).getBounds();
                    preferredSize.width = Math.max(bounds.x + bounds.width, preferredSize.width);
                    preferredSize.height = Math.max(bounds.y + bounds.height, preferredSize.height);
                }
                Insets insets = panel23.getInsets();
                preferredSize.width += insets.right;
                preferredSize.height += insets.bottom;
                panel23.setMinimumSize(preferredSize);
                panel23.setPreferredSize(preferredSize);
            }
        }
        add(panel23);
        panel23.setBounds(15, 360, 325, 110);

        //---- btnID ----
        btnID.setText("GetDeviceID");
        btnID.addActionListener(e -> btnIDActionPerformed(e));
        add(btnID);
        btnID.setBounds(new Rectangle(new Point(710, 30), btnID.getPreferredSize()));

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

    private void initUI() {
        for (int k = 1; k <= 30; k++) {
            cmbAntPower.addItem(k);
            cmbAntPower2.addItem(k);
            cmbAntPower3.addItem(k);
            cmbAntPower4.addItem(k);
        }
        cbFrequencyBand.addItem("China1(840~845MHz)");
        cbFrequencyBand.addItem("China2(920~925MHz)");
        cbFrequencyBand.addItem("Europe(865~868MHz)");
        cbFrequencyBand.addItem("USA(902~928MHz)");
        cbFrequencyBand.addItem("Korea(917~923MHz)");
        cbFrequencyBand.addItem("Japan(952~953MHz)");
        cbFrequencyBand.addItem("Taiwan(920~928Mhz)");
        cbFrequencyBand.addItem("South Africa(915~919MHz)");
        cbFrequencyBand.addItem("Peru(915-928 MHz)");
        cbFrequencyBand.addItem("Russia(860MHz-867.6MHz)");

        cmbProtocol.addItem("ISO18000-6C");
        cmbProtocol.addItem("GB/T 29768");
        cmbProtocol.addItem("GJB 7377.1");
        cmbProtocol.addItem("ISO18000-6B");

        cmbRFLink.addItem("DSB_ASK/FM0/40KH");
        cmbRFLink.addItem("PR_ASK/Miller4/250KHz");
        cmbRFLink.addItem("PR_ASK/Miller4/300KHz");
        cmbRFLink.addItem("DSB_ASK/FM0/400KHz");

        cmbEPCAndTIDUserMode.addItem("EPC");
        cmbEPCAndTIDUserMode.addItem("EPC+TID");
        cmbEPCAndTIDUserMode.addItem("EPC+TID+USER");

        cmb_Gen2_session.addItem("S0");
        cmb_Gen2_session.addItem("S1");
        cmb_Gen2_session.addItem("S2");
        cmb_Gen2_session.addItem("S3");
        cmb_Gen2_target.addItem("A");
        cmb_Gen2_target.addItem("B");

        rbtn_Beep_On.setSelected(true);
        rbtn_Beep_Off.setSelected(false);
        if(UHFMainForm.isEnglish()){
            btnGetPower.setText("GET");
            btnGetFrequencyBand.setText("GET");
            btnSetFrequencyBand.setText("SET");
            label5.setText("Frequency band:");
            btnGetProtocol.setText("GET");
            btnSetProtocol.setText("SET");
            label6.setText("Protocol:");
            label7.setText("Link:");
            btnGetRFLink.setText("GET");
            btnSetRFLink.setText("SET");
            btnGetGen2.setText("GET");
            btnSetGen2.setText("SET");
            label27.setText("Buzzer:");
            rbtn_Beep_On.setText("On");
            rbtn_Beep_Off.setText("Off");
            btnGetBeep.setText("GET");
            btnSetBeep.setText("SET");
            label22.setText("Mode");
            label23.setText("UserOffset:");
            label24.setText("UserLength:");
            btnGetEPCAndTIDUserMode.setText("GET");
            btnSetEPCAndTIDUserMode.setText("SET");

            TitledBorder titledBorder=new TitledBorder("ANT Power");
            panel1.setBorder(titledBorder);
            TitledBorder titledBorder3=new TitledBorder("FrequencyBand");
            panel3.setBorder(titledBorder3);
            TitledBorder titledBorder9=new TitledBorder("Buzzer");
            panel19.setBorder(titledBorder9);
            TitledBorder titledBorder23=new TitledBorder("RFLink");
            panel23.setBorder(titledBorder23);
            TitledBorder titledBorder17=new TitledBorder("Inventory Mode");
            panel17.setBorder(titledBorder17);

            TitledBorder titledBorder5=new TitledBorder("Protocol");
            panel5.setBorder(titledBorder17);

            btnSetPoer.setText("Set");


        }

    }

    // JFormDesigner - Variables declaration - DO NOT MODIFY  //GEN-BEGIN:variables
    private JPanel panel1;
    private JLabel label1;
    private JComboBox cmbAntPower;
    private JButton btnGetPower;
    private JButton btnSetPoer;
    private JComboBox cmbAntPower2;
    private JLabel label2;
    private JLabel label3;
    private JComboBox cmbAntPower3;
    private JComboBox cmbAntPower4;
    private JLabel label4;
    private JPanel panel3;
    private JLabel label5;
    private JComboBox cbFrequencyBand;
    private JButton btnGetFrequencyBand;
    private JButton btnSetFrequencyBand;
    private JPanel panel5;
    private JLabel label6;
    private JComboBox cmbProtocol;
    private JButton btnSetProtocol;
    private JButton btnGetProtocol;
    private JPanel panel17;
    private JLabel label22;
    private JComboBox cmbEPCAndTIDUserMode;
    private JButton btnGetEPCAndTIDUserMode;
    private JButton btnSetEPCAndTIDUserMode;
    private JLabel label23;
    private JTextField tf_user_prt;
    private JLabel label24;
    private JTextField tf_user_len;
    private JPanel panel18;
    private JLabel label25;
    private JComboBox cmb_Gen2_session;
    private JLabel label26;
    private JComboBox cmb_Gen2_target;
    private JButton btnSetGen2;
    private JButton btnGetGen2;
    private JPanel panel19;
    private JLabel label27;
    private JRadioButton rbtn_Beep_On;
    private JRadioButton rbtn_Beep_Off;
    private JButton btnGetBeep;
    private JButton btnSetBeep;
    private JPanel panel23;
    private JComboBox cmbRFLink;
    private JLabel label7;
    private JButton btnSetRFLink;
    private JButton btnGetRFLink;
    private JButton btnID;
    // JFormDesigner - End of variables declaration  //GEN-END:variables
}
