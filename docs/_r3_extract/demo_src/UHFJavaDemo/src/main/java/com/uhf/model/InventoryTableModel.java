package com.uhf.model;

import com.rscja.deviceapi.entity.UHFTAGInfo;

import javax.swing.table.AbstractTableModel;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class InventoryTableModel extends AbstractTableModel {

	private List<UHFTAGInfo> uhftagInfoList=new ArrayList<>();
    private int total=0;
	public String[] columnNames = { "INDEX", "EPC", "TID", "USER","RSSI", "Count", "Ant" };



	public InventoryTableModel() {
	}
    public void addData(UHFTAGInfo info){
		total++;
		boolean[] exists=new boolean[1];
		int index = getInsertIndex(uhftagInfoList,info,exists);
		if(exists[0]){
			UHFTAGInfo temp=uhftagInfoList.get(index);
			temp.setCount(temp.getCount()+1);
		}else{
			uhftagInfoList.add(index,info);
		}
	}
    public int getTagCount(){
		return uhftagInfoList.size();
	}
	public int getTotal(){
        return total;
	}
	@Override
	public int getRowCount() {
		// TODO Auto-generated method stub
		if (uhftagInfoList != null) {
			return uhftagInfoList.size();
		}
		return 0;
	}
	

	@Override
	public int getColumnCount() {
		// TODO Auto-generated method stub
		return columnNames.length;
	}

	@Override
	public String getColumnName(int columnIndex) {
		// TODO Auto-generated method stub
		return columnNames[columnIndex];
	}

	@Override
	public Object getValueAt(int rowIndex, int columnIndex) {
		if (uhftagInfoList != null) {
			UHFTAGInfo uhftagInfo = uhftagInfoList.get(rowIndex);
			switch (columnIndex) {
			case 0:
				return String.valueOf(rowIndex + 1);
			case 1:
				return uhftagInfo.getEPC();
			case 2:
				return uhftagInfo.getTid();
			 case 3:
			 	return uhftagInfo.getUser();
			case 4:
				return uhftagInfo.getRssi();
			case 5:
				return uhftagInfo.getCount();
			case 6:
				return uhftagInfo.getAnt();
			default:
				break;
			}
		}
		return null;
	}

	@Override
	public boolean isCellEditable(int rowIndex, int columnIndex) {
		// TODO Auto-generated method stub
		if(columnIndex == 1) {
			return true;
		}
		return super.isCellEditable(rowIndex, columnIndex);
	}
	

	public void clear() {
		uhftagInfoList.clear();
		total=0;
	}


	public static int getInsertIndex(List<UHFTAGInfo> listData, UHFTAGInfo newInfo, boolean[] exists){
		int startIndex = 0;
		int endIndex = listData.size();
		int judgeIndex;
		int ret;
		if (endIndex == 0){
			exists[0]=false;
			return 0;
		}
		endIndex --;
		while (true){
			judgeIndex = (startIndex + endIndex)/2;
			ret = compareBytes(newInfo.getEpcBytes(), listData.get(judgeIndex).getEpcBytes());
			if (ret > 0){
				if (judgeIndex == endIndex){
					exists[0]=false;
					return judgeIndex+1;
				}
				startIndex = judgeIndex+1;
			} else if (ret < 0){
				if (judgeIndex == startIndex){
					exists[0]=false;
					return judgeIndex;
				}
				endIndex = judgeIndex-1;
			} else {
				exists[0]=true;
				return judgeIndex;
			}
		}
	}

	//return 1,2 b1>b2
	//return -1,-2 b1<b2
	//retrurn 0;b1 == b2
	private static int compareBytes(byte[] b1, byte[] b2){
		int len = b1.length < b2.length?b1.length:b2.length;
		int value1;
		int value2;
		for (int i = 0; i < len; i++){
			value1 = b1[i]&0xFF;
			value2 = b2[i]&0xFF;
			if (value1 > value2){
				return 1;
			} else if (value1 < value2){
				return -1;
			}
		}
		if (b1.length > b2.length){
			return 2;
		} else if (b1.length < b2.length){
			return -2;
		}else {
			return 0;
		}
	}
}
